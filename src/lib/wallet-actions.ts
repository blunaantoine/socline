// Atomic deposit / withdrawal processing shared by the admin endpoints.
//
// Both flows are implemented as guarded Prisma transactions:
//   - the status flip is a conditional updateMany (WHERE status = PENDING) so
//     a double-click or two concurrent admins can NEVER process twice;
//   - balance changes happen inside the same transaction (all-or-nothing);
//   - a notification (in-app + realtime + SMS) is sent AFTER the transaction
//     commits, via the centralized notify() service.

import { db } from '@/lib/db';
import { notify } from '@/lib/notify';

type DepositAction = 'validate' | 'reject';
type WithdrawalAction = 'approve' | 'reject';

export interface ProcessResult {
  ok: boolean;
  code:
    | 'OK'
    | 'NOT_FOUND'
    | 'ALREADY_PROCESSED'
    | 'NOT_A_DEPOSIT'
    | 'INSUFFICIENT_EARNINGS'
    | 'ERROR';
  error?: string;
}

const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
const fmtXof = (n: number) => `${fmt(n)} XOF`;

// ---------------------------------------------------------------------------
// DEPOSIT — admin validates (credits the wallet) or rejects.
// ---------------------------------------------------------------------------
export async function processDeposit(
  transactionId: string,
  action: DepositAction
): Promise<ProcessResult & { wallet?: { userId: string; balance: number } }> {
  let walletInfo: { userId: string; balance: number } | null = null;

  try {
    const outcome = await db.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: transactionId },
        include: { wallet: { select: { id: true, userId: true, balance: true } } },
      });

      if (!transaction) return { code: 'NOT_FOUND' as const };
      if (transaction.type !== 'DEPOSIT') return { code: 'NOT_A_DEPOSIT' as const };

      // Guarded status flip — fails (count 0) if already processed.
      const flip = await tx.walletTransaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data:
          action === 'validate'
            ? {
                status: 'COMPLETED',
                description: `Rechargement validé via ${transaction.paymentMethod ?? 'Mobile Money'}`,
              }
            : {
                status: 'FAILED',
                description: `Rechargement échoué via ${transaction.paymentMethod ?? 'Mobile Money'}`,
              },
      });

      if (flip.count === 0) return { code: 'ALREADY_PROCESSED' as const };

      if (action === 'validate') {
        const updatedWallet = await tx.wallet.update({
          where: { id: transaction.wallet.id },
          data: {
            balance: { increment: transaction.amount },
            totalDeposited: { increment: transaction.amount },
          },
        });

        await tx.walletTransaction.update({
          where: { id: transactionId },
          data: { balanceAfter: updatedWallet.balance },
        });

        return {
          code: 'OK' as const,
          wallet: { userId: transaction.wallet.userId, balance: updatedWallet.balance },
        };
      }

      return {
        code: 'OK' as const,
        wallet: { userId: transaction.wallet.userId, balance: transaction.wallet.balance },
      };
    });

    if (outcome.code !== 'OK') {
      return { ok: false, code: outcome.code };
    }
    walletInfo = outcome.wallet!;
  } catch (error) {
    console.error('[WalletActions] processDeposit error:', error);
    return { ok: false, code: 'ERROR', error: 'Erreur lors du traitement du dépôt' };
  }

  // Notification AFTER commit (in-app + realtime + SMS).
  try {
    const user = await db.user.findUnique({
      where: { id: walletInfo.userId },
      select: { phone: true },
    });
    const phone = user?.phone ?? '';

    if (action === 'validate') {
      await notify({
        userId: walletInfo.userId,
        type: 'payment',
        title: 'Rechargement validé ✅',
        message: `Votre rechargement a été validé. Nouveau solde : ${fmtXof(walletInfo.balance)}.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Rechargement valide. Nouveau solde: ${fmt(walletInfo.balance)} XOF.`,
            }
          : undefined,
      });
    } else {
      await notify({
        userId: walletInfo.userId,
        type: 'payment',
        title: 'Rechargement échoué ❌',
        message: `Votre demande de rechargement n'a pas été validée. Contactez le support si vous avez déjà payé.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Rechargement non valide. Contactez le support si vous avez paye.`,
            }
          : undefined,
      });
    }
  } catch (error) {
    console.warn('[WalletActions] deposit notification failed:', error);
  }

  return { ok: true, code: 'OK', wallet: walletInfo };
}

// ---------------------------------------------------------------------------
// WITHDRAWAL — admin approves (debits the washer earnings) or rejects.
// ---------------------------------------------------------------------------
export async function processWithdrawal(
  withdrawalId: string,
  action: WithdrawalAction
): Promise<ProcessResult> {
  let info: { washerUserId: string; amount: number; balanceAfter: number | null } | null = null;

  try {
    const outcome = await db.$transaction(async (tx) => {
      const withdrawal = await tx.washerWithdrawal.findUnique({
        where: { id: withdrawalId },
        include: { washer: { select: { userId: true } } },
      });

      if (!withdrawal) return { code: 'NOT_FOUND' as const };

      // Guarded status flip — fails (count 0) if already processed.
      const flip = await tx.washerWithdrawal.updateMany({
        where: { id: withdrawalId, status: 'PENDING' },
        data:
          action === 'approve'
            ? { status: 'COMPLETED', processedAt: new Date() }
            : { status: 'REJECTED', processedAt: new Date() },
      });

      if (flip.count === 0) return { code: 'ALREADY_PROCESSED' as const };

      if (action === 'approve') {
        const washer = await tx.washer.update({
          where: { id: withdrawal.washerId },
          data: { totalEarnings: { decrement: withdrawal.amount } },
        });

        // Roll the whole transaction back if the earnings went negative
        // (concurrent-withdrawal race).
        if (washer.totalEarnings < 0) {
          throw new Error('INSUFFICIENT_EARNINGS');
        }

        return {
          code: 'OK' as const,
          washerUserId: withdrawal.washer.userId,
          amount: withdrawal.amount,
          balanceAfter: washer.totalEarnings,
        };
      }

      return {
        code: 'OK' as const,
        washerUserId: withdrawal.washer.userId,
        amount: withdrawal.amount,
        balanceAfter: null,
      };
    });

    if (outcome.code !== 'OK') {
      return { ok: false, code: outcome.code };
    }
    info = {
      washerUserId: outcome.washerUserId!,
      amount: outcome.amount,
      balanceAfter: outcome.balanceAfter,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_EARNINGS') {
      return {
        ok: false,
        code: 'INSUFFICIENT_EARNINGS',
        error: 'Solde insuffisant sur les gains du laveur (déjà retiré ?)',
      };
    }
    console.error('[WalletActions] processWithdrawal error:', error);
    return { ok: false, code: 'ERROR', error: 'Erreur lors du traitement du retrait' };
  }

  // Notification AFTER commit (in-app + realtime + SMS).
  try {
    const user = await db.user.findUnique({
      where: { id: info.washerUserId },
      select: { phone: true },
    });
    const phone = user?.phone ?? '';

    if (action === 'approve') {
      await notify({
        userId: info.washerUserId,
        type: 'payment',
        title: 'Retrait approuvé 💸',
        message:
          info.balanceAfter != null
            ? `Votre retrait de ${fmtXof(info.amount)} a été approuvé et payé sur votre Mobile Money. Nouveau solde de gains : ${fmtXof(info.balanceAfter)}.`
            : `Votre retrait de ${fmtXof(info.amount)} a été approuvé et payé sur votre Mobile Money.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Retrait de ${fmt(info.amount)} XOF approuve et paye.`,
            }
          : undefined,
      });
    } else {
      await notify({
        userId: info.washerUserId,
        type: 'payment',
        title: 'Retrait refusé ❌',
        message: `Votre demande de retrait de ${fmtXof(info.amount)} a été refusée. Le montant reste sur vos gains.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Retrait de ${fmt(info.amount)} XOF refuse. Le montant reste sur vos gains.`,
            }
          : undefined,
      });
    }
  } catch (error) {
    console.warn('[WalletActions] withdrawal notification failed:', error);
  }

  return { ok: true, code: 'OK' };
}
