import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';

// POST /api/washers/settle-commission
// ---------------------------------------------------------------
// The washer repays his outstanding CASH commission debt (cashDebt) from
// his WALLET balance. This is the self-service recovery path: he collects
// cash from clients, so the platform's commission must come back before
// he can withdraw his earnings (a guard on POST /api/withdrawals blocks
// withdrawals above totalEarnings - cashDebt).
//
// Body: {} — settles as much as possible: min(cashDebt, wallet.balance).
// Auth: the session washer himself.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const washer = await db.washer.findUnique({
      where: { userId: auth.user!.id },
      include: { user: { select: { name: true, phone: true } } },
    });

    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Profil de laveur introuvable' },
        { status: 404 }
      );
    }

    if (washer.cashDebt <= 0) {
      return NextResponse.json(
        { success: false, error: 'Aucune commission à régler' },
        { status: 400 }
      );
    }

    const wallet = await db.wallet.findUnique({
      where: { userId: auth.user!.id },
    });

    if (!wallet || wallet.balance <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Portefeuille insuffisant. Rechargez votre portefeuille pour régler vos ${washer.cashDebt.toLocaleString('fr-FR')} XOF de commission.`,
          cashDebt: washer.cashDebt,
          balance: wallet?.balance ?? 0,
        },
        { status: 400 }
      );
    }

    // Settle as much as the wallet allows (partial settlements supported).
    const settledAmount = Math.min(washer.cashDebt, wallet.balance);

    const result = await db.$transaction(async (tx) => {
      // Re-read inside the transaction with a balance guard (throw → rollback).
      const freshWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });

      if (!freshWallet || freshWallet.balance < settledAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const freshWasher = await tx.washer.findUnique({
        where: { id: washer.id },
      });

      if (!freshWasher || freshWasher.cashDebt <= 0) {
        throw new Error('NO_DEBT');
      }

      const applied = Math.min(freshWasher.cashDebt, settledAmount);

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: freshWallet.id,
          type: 'COMMISSION_SETTLEMENT',
          amount: applied,
          status: 'COMPLETED',
          description: `Règlement commission espèces — Société SOCLINE`,
          balanceAfter: freshWallet.balance - applied,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: freshWallet.id },
        data: {
          balance: { decrement: applied },
          totalSpent: { increment: applied },
        },
      });

      const updatedWasher = await tx.washer.update({
        where: { id: washer.id },
        data: {
          cashDebt: { decrement: applied },
        },
      });

      return { transaction, updatedWallet, updatedWasher, applied };
    });

    const remaining = Math.max(0, result.updatedWasher.cashDebt);
    const fmt = (n: number) => n.toLocaleString('fr-FR');

    // Notify the washer + every active admin (recovery trace) — best-effort.
    try {
      await notify({
        userId: auth.user!.id,
        type: 'payment',
        title: 'Commission réglée ✅',
        message: remaining > 0
          ? `${fmt(result.applied)} XOF prélevés de votre portefeuille. Il reste ${fmt(remaining)} XOF de commission à régler.`
          : `${fmt(result.applied)} XOF prélevés de votre portefeuille. Votre commission est entièrement réglée — vous pouvez retirer vos gains.`,
        data: { settled: result.applied, remaining },
      });

      const admins = await db.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });

      for (const admin of admins) {
        await notify({
          userId: admin.id,
          type: 'payment',
          title: 'Commission espèces récupérée 💰',
          message: `${washer.user?.name ?? 'Un laveur'} a réglé ${fmt(result.applied)} XOF de commission${remaining > 0 ? ` (reste dû : ${fmt(remaining)} XOF)` : ' — dette soldée ✅'}.`,
          data: { washerId: washer.id, settled: result.applied, remaining },
        });
      }
    } catch (error) {
      console.warn('[SettleCommission] notification failed:', error);
    }

    return NextResponse.json({
      success: true,
      settled: result.applied,
      remainingDebt: remaining,
      balance: result.updatedWallet.balance,
      message:
        remaining > 0
          ? `${fmt(result.applied)} XOF réglés. Il reste ${fmt(remaining)} XOF de commission à payer.`
          : `Commission entièrement réglée (${fmt(result.applied)} XOF) ✅`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { success: false, error: 'Solde du portefeuille insuffisant' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'NO_DEBT') {
      return NextResponse.json(
        { success: false, error: 'Aucune commission à régler' },
        { status: 400 }
      );
    }
    console.error('Settle commission error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du règlement de la commission' },
      { status: 500 }
    );
  }
}
