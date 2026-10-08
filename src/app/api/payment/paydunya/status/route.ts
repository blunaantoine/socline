// GET /api/payment/paydunya/status?transactionId=…
// Le client (écran Portefeuille) interroge ce endpoint en polling pendant
// que la page de paiement PayDunya est ouverte. Dès que PayDunya confirme,
// le portefeuille est crédité automatiquement (settlePaydunyaDeposit).
// Accès : utilisateur propriétaire du portefeuille uniquement.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { settlePaydunyaDeposit } from '@/lib/paydunya-actions';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId requis' }, { status: 400 });
    }

    // Sécurité : la transaction doit appartenir au portefeuille de l'utilisateur
    const transaction = await db.walletTransaction.findFirst({
      where: {
        id: transactionId,
        wallet: { userId },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }

    const result = await settlePaydunyaDeposit(transactionId);

    return NextResponse.json({
      success: true,
      status: result.settled,
      balance: result.wallet?.balance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';

    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }
    if (message === 'MISSING_PAYDUNYA_TOKEN') {
      return NextResponse.json(
        { error: 'Cette transaction n\'a pas de facture PayDunya' },
        { status: 400 }
      );
    }

    console.error('PayDunya status error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du paiement PayDunya' },
      { status: 500 }
    );
  }
}
