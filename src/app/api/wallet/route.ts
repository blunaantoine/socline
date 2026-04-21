import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/wallet - Get wallet balance and info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

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

// POST /api/wallet - Request deposit (creates PENDING transaction)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, phoneNumber, paymentMethod } = body;

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    if (!phoneNumber || phoneNumber.length < 8) {
      return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Méthode de paiement requise' }, { status: 400 });
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

    // Generate reference
    const externalRef = `DEP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create PENDING transaction (admin will validate)
    const transaction = await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        externalRef,
        phoneNumber,
        paymentMethod,
        description: `Demande de rechargement via ${paymentMethod}`,
        balanceAfter: wallet.balance, // Balance stays same until validated
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Demande de rechargement envoyée. En attente de validation.',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
        phoneNumber: transaction.phoneNumber,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    return NextResponse.json({ error: 'Erreur lors de la demande de rechargement' }, { status: 500 });
  }
}

// PATCH /api/wallet - Pay order with wallet
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, orderId, amount } = body;

    if (!userId || !orderId || !amount) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
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

    // Create transaction
    const transaction = await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'PAYMENT',
        amount,
        status: 'COMPLETED',
        orderId,
        description: `Paiement commande ${orderId}`,
        balanceAfter: wallet.balance - amount,
      },
    });

    // Update wallet balance
    const updatedWallet = await db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount },
        totalSpent: { increment: amount },
      },
    });

    return NextResponse.json({
      success: true,
      transaction,
      wallet: {
        balance: updatedWallet.balance,
      },
    });
  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json({ error: 'Erreur lors du paiement' }, { status: 500 });
  }
}
