import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { expireStalePaydunyaDeposits } from '@/lib/paydunya-actions';

// Helper function to build USSD code
function buildUssdCode(pattern: string, montant: number, numero: string): string {
  return pattern
    .replace('{montant}', montant.toString())
    .replace('{numero}', numero);
}

// Helper function to build USSD link (tel: URI)
function buildUssdLink(ussdCode: string): string {
  // Replace # with %23 for tel: URI
  const encodedCode = ussdCode.replace(/#/g, '%23');
  return `tel:${encodedCode}`;
}

// GET /api/wallet - Get wallet balance and info
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    // Recharges PayDunya jamais abouties (client parti pendant le paiement,
    // page de checkout fermée…) → passées automatiquement en ÉCHOUÉ dès le
    // chargement du portefeuille. Quasi gratuit quand il n'y a rien à
    // expirer (une seule requête indexée) ; chaque dépôt concerné est
    // reconfirmé auprès de PayDunya avant d'être marqué échoué.
    await expireStalePaydunyaDeposits().catch((e) =>
      console.warn('[PayDunya] expiration des dépôts abandonnés :', e)
    );

    // Get or create wallet
    let wallet = await db.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      // Create wallet for user
      wallet = await db.wallet.create({
        data: {
          userId,
          balance: 0,
          totalDeposited: 0,
          totalSpent: 0,
          isActive: true,
        },
        include: {
          transactions: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        totalDeposited: wallet.totalDeposited,
        totalSpent: wallet.totalSpent,
        isActive: wallet.isActive,
        transactions: wallet.transactions,
      },
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/wallet - Request deposit (creates PENDING transaction with USSD code)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const { amount, phoneNumber, operatorId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      return NextResponse.json({ error: 'Numéro de téléphone requis (8 chiffres minimum)' }, { status: 400 });
    }

    if (!operatorId) {
      return NextResponse.json({ error: 'Opérateur requis' }, { status: 400 });
    }

    // Get operator configuration
    const operator = await db.mobileMoneyOperator.findUnique({
      where: { id: operatorId }
    });

    if (!operator || !operator.isActive) {
      return NextResponse.json({ error: 'Opérateur non disponible' }, { status: 400 });
    }

    // Validate amount limits
    if (amount < operator.minAmount) {
      return NextResponse.json({
        error: `Montant minimum: ${operator.minAmount.toLocaleString()} XOF`
      }, { status: 400 });
    }

    if (amount > operator.maxAmount) {
      return NextResponse.json({
        error: `Montant maximum: ${operator.maxAmount.toLocaleString()} XOF`
      }, { status: 400 });
    }

    // Check for duplicate pending transaction (same amount, phone, within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingTransaction = await db.walletTransaction.findFirst({
      where: {
        phoneNumber,
        amount,
        status: 'PENDING',
        paymentMethod: operator.name,
        createdAt: { gte: fiveMinutesAgo }
      }
    });

    if (existingTransaction) {
      return NextResponse.json({
        error: 'Une transaction similaire est déjà en attente. Veuillez patienter.',
        existingTransaction: {
          id: existingTransaction.id,
          amount: existingTransaction.amount,
          createdAt: existingTransaction.createdAt
        }
      }, { status: 400 });
    }

    // Get or create wallet
    let wallet = await db.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          userId,
          balance: 0,
          totalDeposited: 0,
          totalSpent: 0,
          isActive: true,
        },
      });
    }

    // Generate USSD code using operator pattern
    const ussdCode = buildUssdCode(operator.ussdPattern, amount, operator.recipientNumber);
    const ussdLink = buildUssdLink(ussdCode);

    // Generate reference
    const externalRef = `DEP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create PENDING transaction
    const transaction = await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        externalRef,
        phoneNumber,
        paymentMethod: operator.name,
        ussdCode,
        description: `Rechargement via ${operator.displayName}`,
        balanceAfter: wallet.balance,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction créée. Veuillez effectuer le paiement via le code USSD.',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
        phoneNumber: transaction.phoneNumber,
        paymentMethod: transaction.paymentMethod,
        ussdCode,
        ussdLink,
        recipientNumber: operator.recipientNumber,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    return NextResponse.json({ error: 'Erreur lors de la demande de rechargement' }, { status: 500 });
  }
}

// PUT /api/wallet - Confirm USSD payment (user clicked "J'ai payé")
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Get transaction — scoped to the session user's wallet only
    const transaction = await db.walletTransaction.findFirst({
      where: {
        id: transactionId,
        wallet: { userId: auth.user!.id }
      },
      include: { wallet: true }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }

    if (transaction.status !== 'PENDING') {
      return NextResponse.json({
        error: 'Cette transaction a déjà été traitée',
        status: transaction.status
      }, { status: 400 });
    }

    // Update transaction with confirmation time
    const updatedTransaction = await db.walletTransaction.update({
      where: { id: transactionId },
      data: {
        ussdConfirmedAt: new Date(),
        description: `${transaction.description} - Paiement confirmé par l'utilisateur, en attente de validation admin`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Confirmation enregistrée. Un administrateur validera votre paiement sous peu.',
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    return NextResponse.json({ error: 'Erreur lors de la confirmation' }, { status: 500 });
  }
}

// PATCH /api/wallet - Pay order with wallet
// Identity and amount are derived server-side: userId from the session,
// amount from the order. Client-supplied userId/amount are ignored.
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Load the order — the amount always comes from the order
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Ownership check: only the order's client can pay it with their wallet
    if (order.clientId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cette commande est annulée' }, { status: 400 });
    }

    const amount = order.totalPrice;

    // Double-payment guard: a completed wallet transaction for this order
    // or a completed WALLET Payment record blocks any retry.
    const existingWalletPayment = await db.walletTransaction.findFirst({
      where: { orderId, type: 'PAYMENT', status: 'COMPLETED' },
    });

    if (existingWalletPayment) {
      return NextResponse.json({ error: 'Cette commande a déjà été payée' }, { status: 400 });
    }

    const existingCompletedPayment = await db.payment.findFirst({
      where: { orderId, method: 'WALLET', status: 'COMPLETED' },
    });

    if (existingCompletedPayment) {
      return NextResponse.json({ error: 'Cette commande a déjà été payée' }, { status: 400 });
    }

    // Get wallet
    const wallet = await db.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Portefeuille non trouvé' }, { status: 404 });
    }

    if (wallet.balance < amount) {
      return NextResponse.json({
        error: 'Solde insuffisant',
        balance: wallet.balance,
        required: amount,
      }, { status: 400 });
    }

    // Atomic debit: re-read the wallet inside the transaction with a balance
    // guard (throw → rollback), create the PAYMENT transaction, decrement the
    // balance and flip any PENDING WALLET Payment record to COMPLETED.
    const result = await db.$transaction(async (tx) => {
      const freshWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });

      if (!freshWallet || freshWallet.balance < amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: freshWallet.id,
          type: 'PAYMENT',
          amount,
          status: 'COMPLETED',
          orderId,
          description: `Paiement commande ${orderId}`,
          balanceAfter: freshWallet.balance - amount,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: freshWallet.id },
        data: {
          balance: { decrement: amount },
          totalSpent: { increment: amount },
        },
      });

      // If a PENDING WALLET Payment record exists for this order, complete it
      const pendingPayment = await tx.payment.findFirst({
        where: { orderId, method: 'WALLET', status: 'PENDING' },
      });

      if (pendingPayment) {
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: { status: 'COMPLETED' },
        });
      }

      return { transaction, updatedWallet };
    });

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      wallet: {
        balance: result.updatedWallet.balance,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
    }
    console.error('Payment error:', error);
    return NextResponse.json({ error: 'Erreur lors du paiement' }, { status: 500 });
  }
}
