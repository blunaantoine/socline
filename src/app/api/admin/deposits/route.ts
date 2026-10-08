import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { processDeposit } from '@/lib/wallet-actions';
import { settlePaydunyaDeposit } from '@/lib/paydunya-actions';

// GET /api/admin/deposits - Get all pending deposits
export async function GET(request: NextRequest) {
  // Check admin authorization
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const transactions = await db.walletTransaction.findMany({
      where: {
        type: 'DEPOSIT',
        status: status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
        // Les dépôts PayDunya ne font JAMAIS partie de la file de validation
        // admin : ils sont validés AUTOMATIQUEMENT dès que PayDunya confirme
        // le paiement (webhook IPN + polling client + settle). Cette file ne
        // liste que les dépôts à validation manuelle (USSD Mixx by Yas).
        // NB : provider est nullable (dépôts USSD anciens) → garder les null.
        ...(status === 'PENDING'
          ? { OR: [{ provider: null }, { provider: { not: 'PAYDUNYA' } }] }
          : {}),
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedDeposits = transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      provider: tx.provider,
      phoneNumber: tx.phoneNumber,
      paymentMethod: tx.paymentMethod,
      description: tx.description,
      externalRef: tx.externalRef,
      createdAt: tx.createdAt,
      user: tx.wallet.user,
    }));

    return NextResponse.json({
      success: true,
      deposits: formattedDeposits,
    });
  } catch (error) {
    console.error('Get deposits error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/deposits - Validate or reject a deposit
// Deux cas :
//   - PayDunya : la validation vient UNIQUEMENT du STATUT PAYDUNYA — toute
//     action admin reconfirme d'abord le paiement auprès de PayDunya et le
//     portefeuille n'est crédité QUE si PayDunya indique "completed".
//   - USSD Mixx by Yas : validation manuelle par l'admin (processDeposit).
export async function PATCH(request: NextRequest) {
  // Check admin authorization
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { transactionId, action } = body; // action: 'validate' or 'reject'

    if (!transactionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (action !== 'validate' && action !== 'reject') {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    const tx = await db.walletTransaction.findUnique({
      where: { id: transactionId },
      select: { type: true, provider: true },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }
    if (tx.type !== 'DEPOSIT') {
      return NextResponse.json(
        { error: 'Cette transaction n\'est pas un dépôt' },
        { status: 400 }
      );
    }

    // --- PayDunya : source de vérité = statut PayDunya (jamais l'admin) ---
    if (tx.provider === 'PAYDUNYA') {
      const settled = await settlePaydunyaDeposit(transactionId);

      if (settled.settled === 'COMPLETED') {
        if (action === 'reject') {
          return NextResponse.json(
            {
              error:
                'Impossible de rejeter : PayDunya confirme que ce paiement est complété (portefeuille déjà crédité).',
            },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message:
            'Paiement confirmé par PayDunya — portefeuille crédité automatiquement',
          wallet: settled.wallet,
        });
      }

      if (settled.settled === 'FAILED') {
        return NextResponse.json({
          success: true,
          message:
            'PayDunya indique un paiement non abouti — transaction marquée comme échouée',
        });
      }

      // PayDunya n'a pas encore confirmé (pending / unknown)
      if (action === 'reject') {
        return NextResponse.json(
          {
            error:
              'PayDunya indique un paiement toujours en cours — réessayez plus tard.',
          },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        pending: true,
        message:
          'PayDunya n\'a pas encore confirmé ce paiement. Le solde sera crédité automatiquement dès sa confirmation.',
      });
    }

    // --- USSD Mixx by Yas : validation manuelle par l'admin ---
    const result = await processDeposit(transactionId, action);

    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'ALREADY_PROCESSED' || result.code === 'NOT_A_DEPOSIT'
            ? 400
            : 500;
      const message =
        result.code === 'NOT_FOUND'
          ? 'Transaction non trouvée'
          : result.code === 'ALREADY_PROCESSED'
            ? 'Cette transaction a déjà été traitée'
            : result.code === 'NOT_A_DEPOSIT'
              ? 'Cette transaction n\'est pas un dépôt'
              : result.error || 'Erreur lors du traitement';
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: action === 'validate' ? 'Rechargement validé avec succès' : 'Rechargement marqué comme échoué',
      wallet: result.wallet,
    });
  } catch (error) {
    console.error('Update deposit error:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement' }, { status: 500 });
  }
}
