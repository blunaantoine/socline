import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/transactions — HISTORIQUE GLOBAL DES TRANSACTIONS
// ---------------------------------------------------------------
// Toutes les transactions de portefeuille de la plateforme, la plus récente
// d'abord : rechargements (DEPOSIT), paiements de commandes (PAYMENT),
// retraits (WITHDRAWAL), remboursements (REFUND), bonus (BONUS) et
// règlements de commission espèces (COMMISSION_SETTLEMENT).
//
// Query params :
//   type    — filtre par type (ex: DEPOSIT, WITHDRAWAL, ...)
//   status  — filtre par statut (PENDING, COMPLETED, FAILED, CANCELLED)
//   take    — nombre max (défaut 200)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const take = Math.min(500, Math.max(1, Number(searchParams.get('take')) || 200));

    const where: Record<string, string> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, deposits, withdrawals, payments, settlements] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          wallet: {
            include: {
              user: { select: { id: true, name: true, phone: true, role: true } },
            },
          },
        },
      }),
      // Totaux agrégés (toutes périodes, statuts COMPLETED uniquement)
      db.walletTransaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      db.walletTransaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      db.walletTransaction.aggregate({
        where: { type: 'PAYMENT', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      db.walletTransaction.aggregate({
        where: { type: 'COMMISSION_SETTLEMENT', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      summary: {
        deposits: { total: deposits._sum.amount ?? 0, count: deposits._count },
        withdrawals: { total: withdrawals._sum.amount ?? 0, count: withdrawals._count },
        payments: { total: payments._sum.amount ?? 0, count: payments._count },
        commissionSettlements: { total: settlements._sum.amount ?? 0, count: settlements._count },
      },
    });
  } catch (error) {
    console.error('Get admin transactions error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des transactions' },
      { status: 500 }
    );
  }
}
