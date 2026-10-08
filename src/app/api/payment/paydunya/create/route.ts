// POST /api/payment/paydunya/create
// Créer une facture PayDunya pour recharger le portefeuille.
// Le client est ensuite redirigé vers la page de checkout PayDunya
// (T-Money, Moov Money, Wave…) et le portefeuille est crédité
// automatiquement dès confirmation PayDunya.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/payment-settings';
import { createPaydunyaInvoice } from '@/lib/paydunya';

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 500000;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }
    if (amount < MIN_AMOUNT) {
      return NextResponse.json(
        { error: `Montant minimum : ${MIN_AMOUNT.toLocaleString('fr-FR')} XOF` },
        { status: 400 }
      );
    }
    if (amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Montant maximum : ${MAX_AMOUNT.toLocaleString('fr-FR')} XOF` },
        { status: 400 }
      );
    }

    // Le système actif doit être PayDunya (choix de l'admin)
    const config = await getPaymentConfig();
    if (config.provider !== 'PAYDUNYA') {
      return NextResponse.json(
        { error: 'PayDunya n\'est pas le système de paiement actif' },
        { status: 400 }
      );
    }
    if (!config.paydunyaConfigured) {
      return NextResponse.json(
        { error: 'PayDunya n\'est pas encore configuré par l\'administrateur' },
        { status: 503 }
      );
    }

    // Portefeuille (créé au besoin)
    let wallet = await db.wallet.findUnique({ where: { userId } });
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

    // Transaction PENDING (paydunyaToken renseigné après création de la facture)
    const externalRef = `DEP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const transaction = await db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        externalRef,
        provider: 'PAYDUNYA',
        paymentMethod: 'PayDunya',
        description: `Rechargement via PayDunya (${config.paydunya.storeName})`,
        balanceAfter: wallet.balance,
      },
    });

    try {
      const invoice = await createPaydunyaInvoice({
        amount,
        description: `Rechargement portefeuille ${config.paydunya.storeName} de ${amount.toLocaleString('fr-FR')} XOF`,
        customData: { transactionId: transaction.id },
      });

      await db.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          paydunyaToken: invoice.token,
          paydunyaUrl: invoice.checkoutUrl,
        },
      });

      return NextResponse.json({
        success: true,
        transactionId: transaction.id,
        token: invoice.token,
        checkoutUrl: invoice.checkoutUrl,
        amount,
      });
    } catch (invoiceError) {
      // La facture n'a pas pu être créée → la transaction ne doit pas rester PENDING
      await db.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          description: `Rechargement PayDunya — échec de création de la facture : ${
            invoiceError instanceof Error ? invoiceError.message : 'erreur inconnue'
          }`,
        },
      });
      throw invoiceError;
    }
  } catch (error) {
    console.error('PayDunya create invoice error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la création du paiement PayDunya',
      },
      { status: 500 }
    );
  }
}
