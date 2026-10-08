// ---------------------------------------------------------------------------
// Socline — Traitement des dépôts PayDunya (validation AUTOMATIQUE)
//
// Contrairement au flux USSD (validation manuelle par l'admin), le flux
// PayDunya crédite le portefeuille dès que PayDunya confirme le paiement.
//
// Garanties :
//   - le statut est TOUJOURS reconfirmé auprès de l'API PayDunya (l'IPN ou
//     le client ne sont jamais crus sur parole) ;
//   - le basculement de statut est un updateMany conditionnel (WHERE
//     status = PENDING) → impossible de créditer deux fois ;
//   - le crédit du solde se fait dans la même transaction Prisma ;
//   - la notification (in-app + realtime + SMS) part après le commit.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { notify } from '@/lib/notify';
import { confirmPaydunyaInvoice } from '@/lib/paydunya';

export type PaydunyaSettleStatus = 'COMPLETED' | 'FAILED' | 'PENDING';

export interface SettleResult {
  settled: PaydunyaSettleStatus;
  transactionId: string;
  wallet?: { userId: string; balance: number };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Vérifier le paiement PayDunya et créditer le portefeuille si payé.
// Idempotent : peut être appelé par le polling client, l'IPN, l'admin…
// sans risque de double crédit.
export async function settlePaydunyaDeposit(
  transactionId: string
): Promise<SettleResult> {
  const transaction = await db.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: { select: { id: true, userId: true, balance: true } } },
  });

  if (!transaction) {
    throw new Error('NOT_FOUND');
  }

  // Déjà traité → retour immédiat (idempotence)
  if (transaction.status === 'COMPLETED') {
    return {
      settled: 'COMPLETED',
      transactionId,
      wallet: {
        userId: transaction.wallet.userId,
        balance: transaction.balanceAfter || transaction.wallet.balance,
      },
    };
  }
  if (transaction.status !== 'PENDING') {
    return { settled: 'FAILED', transactionId };
  }

  if (!transaction.paydunyaToken) {
    throw new Error('MISSING_PAYDUNYA_TOKEN');
  }

  // 1) Source de vérité : confirmation auprès de PayDunya
  const confirmation = await confirmPaydunyaInvoice(transaction.paydunyaToken);

  // 2) Cohérence du montant (si PayDunya renvoie le montant)
  if (
    typeof confirmation.amount === 'number' &&
    confirmation.amount !== Math.round(transaction.amount)
  ) {
    console.error(
      `[PayDunya] Montant incohérent pour ${transactionId}: attendu ${transaction.amount}, reçu ${confirmation.amount}`
    );
  }

  if (confirmation.status === 'pending' || confirmation.status === 'unknown') {
    await db.walletTransaction.update({
      where: { id: transactionId },
      data: { paydunyaStatusCheckedAt: new Date() },
    });
    return { settled: 'PENDING', transactionId };
  }

  // 3) Basculement gardé + crédit dans UNE transaction Prisma
  const finalStatus = confirmation.status === 'completed' ? 'COMPLETED' : 'FAILED';

  const outcome = await db.$transaction(async (tx) => {
    // Flip conditionnel : échoue (count 0) si déjà traité par un concurrent
    const flip = await tx.walletTransaction.updateMany({
      where: { id: transactionId, status: 'PENDING' },
      data: {
        status: finalStatus,
        paydunyaStatusCheckedAt: new Date(),
        description:
          finalStatus === 'COMPLETED'
            ? `Rechargement confirmé via PayDunya${confirmation.paymentMethod ? ` (${confirmation.paymentMethod})` : ''}`
            : `Rechargement PayDunya non abouti (${confirmation.status})`,
      },
    });

    if (flip.count === 0) {
      return { code: 'ALREADY_PROCESSED' as const };
    }

    if (finalStatus === 'COMPLETED') {
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

  if (outcome.code === 'ALREADY_PROCESSED') {
    // Un autre appel concurrent a déjà traité cette transaction
    const fresh = await db.walletTransaction.findUnique({
      where: { id: transactionId },
      select: { status: true },
    });
    return {
      settled: fresh?.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
      transactionId,
    };
  }

  // 4) Notification après commit
  try {
    const user = await db.user.findUnique({
      where: { id: outcome.wallet!.userId },
      select: { phone: true },
    });
    const phone = user?.phone ?? '';

    if (finalStatus === 'COMPLETED') {
      await notify({
        userId: outcome.wallet!.userId,
        type: 'payment',
        title: 'Rechargement confirmé ✅',
        message: `Votre paiement PayDunya a été confirmé. Nouveau solde : ${fmt(outcome.wallet!.balance)} XOF.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Rechargement PayDunya confirme. Nouveau solde: ${fmt(outcome.wallet!.balance)} XOF.`,
            }
          : undefined,
      });
    } else {
      await notify({
        userId: outcome.wallet!.userId,
        type: 'payment',
        title: 'Paiement PayDunya non abouti ❌',
        message: `Votre paiement PayDunya n'a pas été confirmé (${confirmation.status}). Vous pouvez réessayer ou contacter le support.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Paiement PayDunya non abouti. Reessayez ou contactez le support.`,
            }
          : undefined,
      });
    }
  } catch (error) {
    console.warn('[PayDunya] notification failed:', error);
  }

  return {
    settled: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
    transactionId,
    wallet: outcome.wallet,
  };
}
