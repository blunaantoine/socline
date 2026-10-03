import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { processWithdrawal } from '@/lib/wallet-actions';

// GET /api/admin/withdrawals - Get pending withdrawals
export async function GET(request: NextRequest) {
  // Check admin authorization
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const withdrawals = await db.washerWithdrawal.findMany({
      where: { status: status as 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' },
      orderBy: { createdAt: 'desc' },
      include: {
        washer: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des retraits' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/withdrawals - Approve or reject withdrawal
// Delegates to the shared atomic processor (guarded status flip + earnings
// debit inside ONE transaction) and notifies the washer in-app, in realtime
// and by SMS.
export async function PATCH(request: NextRequest) {
  // Check admin authorization
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { withdrawalId, action } = body;

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'Action invalide' },
        { status: 400 }
      );
    }

    const result = await processWithdrawal(withdrawalId, action);

    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'ALREADY_PROCESSED'
            ? 400
            : 500;
      const message =
        result.code === 'NOT_FOUND'
          ? 'Retrait non trouvé'
          : result.code === 'ALREADY_PROCESSED'
            ? 'Ce retrait a déjà été traité'
            : result.error || 'Erreur lors du traitement';
      return NextResponse.json({ success: false, error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Retrait approuvé' : 'Retrait rejeté',
    });
  } catch (error) {
    console.error('Withdrawal action error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du traitement' },
      { status: 500 }
    );
  }
}
