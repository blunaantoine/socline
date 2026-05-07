import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

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

    const withdrawal = await db.washerWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Retrait non trouvé' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Ce retrait a déjà été traité' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Update withdrawal status
      await db.washerWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      // Deduct from washer's earnings
      const washer = await db.washer.findUnique({
        where: { id: withdrawal.washerId },
      });

      if (washer) {
        await db.washer.update({
          where: { id: withdrawal.washerId },
          data: {
            totalEarnings: Math.max(0, washer.totalEarnings - withdrawal.amount),
          },
        });
      }
    } else if (action === 'reject') {
      // Update withdrawal status
      await db.washerWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          processedAt: new Date(),
        },
      });
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
