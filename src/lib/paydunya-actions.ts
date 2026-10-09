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
//     status = …) → impossible de créditer deux fois ;
//   - le crédit du solde se fait dans la même transaction Prisma ;
//   - un dépôt « en attente » depuis trop longtemps (client qui n'a pas
//     abouti ou qui s'est arrêté en chemin) passe automatiquement en
//     ÉCHOUÉ — mais si PayDunya confirme le paiement après coup (IPN
//     tardif), le crédit est fait en rattrapage : aucune perte possible ;
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
  /** Renseigné quand settled = FAILED : 'timeout' = délai de paiement dépassé */
  reason?: 'timeout';
}

// Délai au-delà duquel un dépôt PayDunya toujours « en attente » est
// considéré comme abandonné (le client n'a pas payé / s'est arrêté en
// chemin) → la recharge passe automatiquement en ÉCHOUÉ.
export const PAYDUNYA_PENDING_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// --- Crédit du portefeuille (basculement conditionnel anti double-crédit) ---
// Le flip conditionnel (WHERE status IN …) échoue (count 0) si un appel
// concurrent a déjà traité la transaction. Bascule + crédit dans UNE
// transaction Prisma.
async function creditDeposit(params: {
  transactionId: string;
  walletId: string;
  userId: string;
  amount: number;
  currentBalance: number;
  fromStatuses: string[];
  description: string;
}): Promise<{ credited: boolean; wallet: { userId: string; balance: number } }> {
  const outcome = await db.$transaction(async (tx) => {
    const flip = await tx.walletTransaction.updateMany({
      where: {
        id: params.transactionId,
        status: { in: params.fromStatuses },
      },
      data: {
        status: 'COMPLETED',
        paydunyaStatusCheckedAt: new Date(),
        description: params.description,
      },
    });

    if (flip.count === 0) {
      return { credited: false as const };
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: params.walletId },
      data: {
        balance: { increment: params.amount },
        totalDeposited: { increment: params.amount },
      },
    });

    await tx.walletTransaction.update({
      where: { id: params.transactionId },
      data: { balanceAfter: updatedWallet.balance },
    });

    return {
      credited: true as const,
      wallet: { userId: params.userId, balance: updatedWallet.balance },
    };
  });

  return {
    credited: outcome.credited,
    wallet: outcome.credited
      ? outcome.wallet
      : { userId: params.userId, balance: params.currentBalance },
  };
}

// --- Notification post-commit (in-app + realtime + SMS) ---
async function getUserPhone(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  return user?.phone ?? null;
}

async function notifyOutcome(params: {
  userId: string;
  phone: string | null;
  kind: 'confirmed' | 'failed';
  amount: number;
  balance?: number;
  detail?: string;
}): Promise<void> {
  const { userId, phone, kind, amount, balance, detail } = params;
  try {
    if (kind === 'confirmed') {
      await notify({
        userId,
        type: 'payment',
        title: 'Rechargement confirmé ✅',
        message: `Votre paiement PayDunya a été confirmé. Nouveau solde : ${fmt(balance ?? amount)} XOF.`,
        sms: phone
          ? {
              phone,
              text: `Socline: Rechargement PayDunya confirme. Nouveau solde: ${fmt(balance ?? amount)} XOF.`,
            }
          : undefined,
      });
    } else {
      await notify({
        userId,
        type: 'payment',
        title: 'Paiement PayDunya non abouti ❌',
        message: `Votre rechargement de ${fmt(amount)} XOF n'a pas été confirmé${detail ? ` (${detail})` : ''}. Vous pouvez réessayer ou contacter le support.`,
        sms: phone
          ? {
              phone,
              text: 'Socline: Paiement PayDunya non abouti. Reessayez ou contactez le support.',
            }
          : undefined,
      });
    }
  } catch (error) {
    console.warn('[PayDunya] notification failed:', error);
  }
}

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

  // Déjà crédité → retour immédiat (idempotence)
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

  const hasToken = Boolean(transaction.paydunyaToken);

  // Déjà échoué/annulé (ex. délai dépassé) : avant de renoncer, on
  // reconfirme auprès de PayDunya — si le paiement est arrivé après coup
  // (IPN tardif, vérification admin), le crédit est fait en rattrapage.
  if (transaction.status === 'FAILED' || transaction.status === 'CANCELLED') {
    if (!hasToken) return { settled: 'FAILED', transactionId };

    let confirmation;
    try {
      confirmation = await confirmPaydunyaInvoice(transaction.paydunyaToken!);
    } catch (error) {
      console.warn(
        `[PayDunya] reconfirmation impossible pour ${transactionId}:`,
        error
      );
      return { settled: 'FAILED', transactionId };
    }

    if (confirmation.status !== 'completed') {
      return { settled: 'FAILED', transactionId };
    }

    const outcome = await creditDeposit({
      transactionId,
      walletId: transaction.wallet.id,
      userId: transaction.wallet.userId,
      amount: transaction.amount,
      currentBalance: transaction.wallet.balance,
      fromStatuses: ['FAILED', 'CANCELLED', 'PENDING'],
      description: `Rechargement confirmé via PayDunya (confirmé après coup)${confirmation.paymentMethod ? ` (${confirmation.paymentMethod})` : ''}`,
    });

    if (outcome.credited) {
      const phone = await getUserPhone(outcome.wallet.userId);
      await notifyOutcome({
        userId: outcome.wallet.userId,
        phone,
        kind: 'confirmed',
        amount: transaction.amount,
        balance: outcome.wallet.balance,
      });
    }

    return {
      settled: 'COMPLETED',
      transactionId,
      wallet: outcome.credited ? outcome.wallet : undefined,
    };
  }

  if (transaction.status !== 'PENDING') {
    return { settled: 'FAILED', transactionId };
  }

  if (!hasToken) {
    throw new Error('MISSING_PAYDUNYA_TOKEN');
  }

  // 1) Source de vérité : confirmation auprès de PayDunya
  const confirmation = await confirmPaydunyaInvoice(transaction.paydunyaToken!);

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
    // Toujours « en attente » côté PayDunya. Si le délai de paiement est
    // dépassé, le client n'a pas abouti (paiement abandonné) → ÉCHOUÉ.
    const pendingMs = Date.now() - transaction.createdAt.getTime();
    if (pendingMs >= PAYDUNYA_PENDING_TIMEOUT_MS) {
      const flip = await db.walletTransaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: {
          status: 'FAILED',
          paydunyaStatusCheckedAt: new Date(),
          description: `Délai de paiement dépassé (${Math.round(
            PAYDUNYA_PENDING_TIMEOUT_MS / 60000
          )} min) — non abouti`,
        },
      });

      if (flip.count > 0) {
        const phone = await getUserPhone(transaction.wallet.userId);
        await notifyOutcome({
          userId: transaction.wallet.userId,
          phone,
          kind: 'failed',
          amount: transaction.amount,
          detail: 'délai dépassé',
        });
      }

      return { settled: 'FAILED', transactionId, reason: 'timeout' };
    }

    await db.walletTransaction.update({
      where: { id: transactionId },
      data: { paydunyaStatusCheckedAt: new Date() },
    });
    return { settled: 'PENDING', transactionId };
  }

  // 3) PayDunya a tranché : complété → crédit ; autre statut → échec
  if (confirmation.status === 'completed') {
    const outcome = await creditDeposit({
      transactionId,
      walletId: transaction.wallet.id,
      userId: transaction.wallet.userId,
      amount: transaction.amount,
      currentBalance: transaction.wallet.balance,
      fromStatuses: ['PENDING'],
      description: `Rechargement confirmé via PayDunya${confirmation.paymentMethod ? ` (${confirmation.paymentMethod})` : ''}`,
    });

    if (!outcome.credited) {
      // Un autre appel concurrent a déjà traité cette transaction
      return { settled: 'COMPLETED', transactionId };
    }

    const phone = await getUserPhone(outcome.wallet.userId);
    await notifyOutcome({
      userId: outcome.wallet.userId,
      phone,
      kind: 'confirmed',
      amount: transaction.amount,
      balance: outcome.wallet.balance,
    });

    return { settled: 'COMPLETED', transactionId, wallet: outcome.wallet };
  }

  // Échec confirmé par PayDunya (cancelled / failed / autre)
  const flip = await db.walletTransaction.updateMany({
    where: { id: transactionId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      paydunyaStatusCheckedAt: new Date(),
      description: `Rechargement PayDunya non abouti (${confirmation.status})`,
    },
  });

  if (flip.count > 0) {
    const phone = await getUserPhone(transaction.wallet.userId);
    await notifyOutcome({
      userId: transaction.wallet.userId,
      phone,
      kind: 'failed',
      amount: transaction.amount,
      detail: confirmation.status,
    });
  }

  return { settled: 'FAILED', transactionId };
}

// ---------------------------------------------------------------------------
// Expiration des dépôts PayDunya jamais aboutis.
//
// Appelé à chaque chargement du portefeuille (GET /api/wallet) : si le
// client a quitté l'application pendant le paiement (ou bloqué sur la page
// PayDunya), la recharge repasse automatiquement en ÉCHOUÉ dès son retour.
// Chaque dépôt repasse par settlePaydunyaDeposit → si PayDunya a en réalité
// confirmé le paiement entre-temps, il est crédité normalement.
// Retourne le nombre de dépôts passés en ÉCHOUÉ.
// ---------------------------------------------------------------------------
export async function expireStalePaydunyaDeposits(): Promise<number> {
  const cutoff = new Date(Date.now() - PAYDUNYA_PENDING_TIMEOUT_MS);

  const stale = await db.walletTransaction.findMany({
    where: {
      status: 'PENDING',
      provider: 'PAYDUNYA',
      paydunyaToken: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  let expired = 0;
  for (const { id } of stale) {
    try {
      const result = await settlePaydunyaDeposit(id);
      if (result.settled === 'FAILED') expired += 1;
    } catch (error) {
      console.warn(`[PayDunya] expiration impossible pour ${id}:`, error);
    }
  }
  return expired;
}
