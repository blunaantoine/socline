import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { processDeposit } from '@/lib/wallet-actions';

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
// Delegates to the shared atomic processor (guarded status flip + crediting
// inside ONE transaction) and sends the user a realtime + SMS notification.
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
