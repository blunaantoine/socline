import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/company';

/**
 * Suppression d'un compte par un admin (n'importe quel compte, même avec des
 * commandes ou de l'argent sur son portefeuille).
 *
 * Le compte est ANONYMISÉ plutôt qu'effacé : nom, numéro, PIN, e-mail, photo,
 * voitures, adresses, favoris, notifications et contenu des messages sont
 * supprimés, la connexion devient impossible. Les commandes et paiements restent,
 * rattachés à « Compte supprimé », pour la comptabilité (conservation 10 ans) et
 * l'historique des gains des laveurs.
 *
 * - Commandes en cours du client → annulées. Commandes acceptées par un laveur
 *   supprimé → remises en attente pour un autre laveur (annulées si le lavage
 *   avait commencé).
 * - Solde du portefeuille → conservé par Socline : remis à 0 avec une
 *   transaction ACCOUNT_CLOSURE qui garde la trace du montant.
 * - Laveur : retraits en attente refusés, numéros de retrait et pièces effacés.
 * - Option : le numéro est bloqué (impossible de se réinscrire).
 */

export interface DeletionSummary {
  cancelledOrders: number;
  releasedOrders: number;
  seizedBalance: number;
  rejectedWithdrawals: number;
  phoneBlocked: boolean;
}

export class DeletionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] as const;

export async function isPhoneBlocked(phone: string): Promise<boolean> {
  const clean = normalizePhone(phone);
  if (!clean) return false;
  return (await db.blockedPhone.count({ where: { phone: clean } })) > 0;
}

/** Aperçu affiché à l'admin avant de confirmer. */
export async function deletionPreview(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, phone: true, role: true, deletedAt: true,
      wallet: { select: { balance: true } },
      washer: { select: { id: true, totalEarnings: true } },
    },
  });
  if (!user) throw new DeletionError('Utilisateur introuvable', 404);
  const [orders, activeOrders] = await Promise.all([
    db.order.count({ where: { OR: [{ clientId: userId }, ...(user.washer ? [{ washerId: user.washer.id }] : [])] } }),
    db.order.count({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        OR: [{ clientId: userId }, ...(user.washer ? [{ washerId: user.washer.id }] : [])],
      },
    }),
  ]);
  return {
    name: user.name,
    phone: user.phone,
    role: user.role,
    alreadyDeleted: Boolean(user.deletedAt),
    orders,
    activeOrders,
    walletBalance: user.wallet?.balance ?? 0,
  };
}

export async function deleteUserAccount(
  userId: string,
  opts: { adminId: string; blockPhone?: boolean; reason?: string | null }
): Promise<DeletionSummary> {
  if (userId === opts.adminId) {
    throw new DeletionError('Vous ne pouvez pas supprimer votre propre compte');
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { wallet: true, washer: true },
  });
  if (!user) throw new DeletionError('Utilisateur introuvable', 404);
  if (user.deletedAt) throw new DeletionError('Ce compte est déjà supprimé');

  const reason = opts.reason?.trim() || null;
  const originalPhone = normalizePhone(user.phone);
  const washerId = user.washer?.id ?? null;
  const now = new Date();

  const summary = await db.$transaction(async (tx) => {
    // 1. Commandes en cours du client → annulées (+ séances d'abonnement libérées).
    const clientActive = await tx.order.findMany({
      where: { clientId: userId, status: { in: [...ACTIVE_STATUSES] } },
      select: { id: true },
    });
    const clientActiveIds = clientActive.map((o) => o.id);
    if (clientActiveIds.length) {
      await tx.order.updateMany({
        where: { id: { in: clientActiveIds } },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'Compte client supprimé par Socline' },
      });
      await tx.subscriptionUsage.updateMany({
        where: { orderId: { in: clientActiveIds }, status: 'PENDING' },
        data: { status: 'CANCELLED', adminNotes: 'Compte supprimé' },
      });
    }

    // 2. Commandes prises par le laveur supprimé.
    let releasedOrders = 0;
    let washerCancelled = 0;
    if (washerId) {
      const released = await tx.order.updateMany({
        where: { washerId, status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } },
        data: { status: 'PENDING', washerId: null, acceptedAt: null, startedAt: null, arrivedAt: null },
      });
      releasedOrders = released.count;
      const started = await tx.order.updateMany({
        where: { washerId, status: 'IN_PROGRESS' },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'Laveur retiré par Socline' },
      });
      washerCancelled = started.count;

      const rejected = await tx.washerWithdrawal.updateMany({
        where: { washerId, status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] } },
        data: { status: 'REJECTED', adminNotes: 'Compte supprimé par Socline' },
      });
      await tx.washerWithdrawalNumber.deleteMany({ where: { washerId } });
      await tx.washer.update({
        where: { id: washerId },
        data: {
          isAvailable: false,
          isVerified: false,
          idDocument: null,
          bankName: null,
          bankAccount: null,
          vehiclePlate: null,
          latitude: null,
          longitude: null,
          address: null,
        },
      });
      await tx.station.updateMany({ where: { ownerId: userId }, data: { isActive: false } });
      // Les clients qui avaient ce laveur en favori ne le verront plus.
      await tx.favorite.deleteMany({ where: { washerId } });
      return { washerCancelled, releasedOrders, rejectedWithdrawals: rejected.count, clientCancelled: clientActiveIds.length };
    }
    return { washerCancelled, releasedOrders, rejectedWithdrawals: 0, clientCancelled: clientActiveIds.length };
  }).then(async (partial) => {
    // 3. Portefeuille : solde conservé par Socline, avec trace du montant.
    let seizedBalance = 0;
    if (user.wallet && user.wallet.balance > 0) {
      seizedBalance = user.wallet.balance;
      await db.$transaction([
        db.walletTransaction.create({
          data: {
            walletId: user.wallet.id,
            type: 'ACCOUNT_CLOSURE',
            amount: seizedBalance,
            status: 'COMPLETED',
            description: 'Solde conservé par Socline à la suppression du compte',
            adminNotes: reason,
            balanceAfter: 0,
          },
        }),
        db.wallet.update({ where: { id: user.wallet.id }, data: { balance: 0, isActive: false } }),
      ]);
    } else if (user.wallet) {
      await db.wallet.update({ where: { id: user.wallet.id }, data: { isActive: false } });
    }

    // 4. Données personnelles effacées, compte désactivé.
    await db.$transaction([
      db.car.deleteMany({ where: { userId } }),
      db.address.deleteMany({ where: { userId } }),
      db.favorite.deleteMany({ where: { clientId: userId } }),
      db.notification.deleteMany({ where: { userId } }),
      db.otpCode.deleteMany({ where: { phone: originalPhone } }),
      db.message.updateMany({
        where: { senderId: userId },
        data: { content: 'Message supprimé', imageUrl: null, latitude: null, longitude: null },
      }),
      db.supportTicket.updateMany({ where: { userId }, data: { name: null, phone: null } }),
      db.userSubscription.updateMany({ where: { userId, isActive: true }, data: { isActive: false, autoRenew: false } }),
      db.company.updateMany({ where: { managerUserId: userId }, data: { managerUserId: null } }),
      db.user.update({
        where: { id: userId },
        data: {
          name: 'Compte supprimé',
          phone: `supprime-${userId}`,
          email: null,
          avatar: null,
          pin: null,
          plateNumber: null,
          carColor: null,
          isActive: false,
          deletedAt: now,
          deletedReason: reason,
        },
      }),
    ]);

    // 5. Blocage du numéro (comptes malveillants).
    let phoneBlocked = false;
    if (opts.blockPhone && originalPhone) {
      await db.blockedPhone.upsert({
        where: { phone: originalPhone },
        create: { phone: originalPhone, reason, blockedBy: opts.adminId },
        update: { reason, blockedBy: opts.adminId },
      });
      phoneBlocked = true;
    }

    return {
      cancelledOrders: partial.clientCancelled + partial.washerCancelled,
      releasedOrders: partial.releasedOrders,
      seizedBalance,
      rejectedWithdrawals: partial.rejectedWithdrawals,
      phoneBlocked,
    };
  });

  return summary;
}
