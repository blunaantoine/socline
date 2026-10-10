// Order step notifications — tells the client (and the washer) what is
// happening at every step of the order lifecycle, through the ONE
// notification pipeline (DB → realtime socket → optional SMS).
//
// Until now, status transitions only fired a transient socket event
// (`order:updated`): a client not sitting on the tracking screen at that
// exact moment saw NOTHING. These persistent notifications complete the
// flow — the client is informed even with the app closed, and the history
// keeps a trace of every step.

import { notify } from '@/lib/notify';
import { formatScheduledLong } from '@/lib/scheduled';

export interface OrderForNotification {
  id: string;
  orderNumber: string;
  status: string;
  address?: string | null;
  cancelReason?: string | null;
  // Rendez-vous planifié (« Plus tard ») : change le message d'acceptation
  // en confirmation ferme de rendez-vous (option C).
  scheduledAt?: string | Date | null;
  // Commande payée via une séance d'abonnement (total à 0, séance décomptée
  // à la complétion) — adapte les messages client et laveur.
  isSubscriptionOrder?: boolean;
  service?: { name?: string } | null;
  client?: { id: string } | null;
  washer?: { userId?: string | null; user?: { id: string; name?: string } | null } | null;
}

interface NotifyOptions {
  // Who triggered the transition — used to avoid notifying the actor about
  // their own action (e.g. the client who just cancelled their order).
  actorRole: 'WASHER' | 'CLIENT' | 'ADMIN';
  // Washer payout credited at COMPLETED, only used for the washer-side
  // "earnings credited" notification.
  washerAmount?: number;
  // Payment method of the order (CASH / WALLET) — the COMPLETED message for
  // the washer differs: with cash he holds the FULL amount and owes the
  // platform its commission back.
  paymentMethod?: 'CASH' | 'WALLET' | null;
  // Commission due to the platform on cash collections (same moment).
  commissionAmount?: number;
  // The order consumes a subscription session (total 0 — washer is credited
  // his partner share of the service price).
  isSubscriptionOrder?: boolean;
}

const CLIENT_STATUS_NOTIFS: Record<
  string,
  { title: string; message: (order: OrderForNotification) => string }
> = {
  ACCEPTED: {
    title: 'Commande acceptée ✅',
    message: (o) => {
      const base = `${o.washer?.user?.name || 'Votre laveur'} a accepté votre commande « ${o.service?.name || ''} ».`;
      // Commande planifiée : l'acceptation devient une confirmation ferme de rendez-vous.
      if (o.scheduledAt) {
        const when = formatScheduledLong(o.scheduledAt);
        if (when) return `${base} Rendez-vous confirmé ${when}.`;
      }
      return base;
    },
  },
  EN_ROUTE: {
    title: 'Le laveur est en route 🚗',
    message: (o) =>
      `${o.washer?.user?.name || 'Votre laveur'} se dirige vers : ${o.address || 'votre adresse'}.`,
  },
  ARRIVED: {
    title: 'Le laveur est arrivé 📍',
    message: (o) =>
      `${o.washer?.user?.name || 'Votre laveur'} est sur place. Vous pouvez l'accueillir.`,
  },
  IN_PROGRESS: {
    title: 'Lavage en cours 🧼',
    message: (o) => `Le lavage « ${o.service?.name || ''} » a commencé.`,
  },
  COMPLETED: {
    title: 'Lavage terminé ✅',
    message: (o) =>
      o.isSubscriptionOrder
        ? `« ${o.service?.name || 'Votre lavage'} » est terminé — 1 séance décomptée de votre abonnement. Merci de votre confiance !`
        : `« ${o.service?.name || 'Votre lavage'} » est terminé. Merci de votre confiance !`,
  },
  CANCELLED: {
    title: 'Commande annulée ❌',
    message: (o) =>
      `« ${o.service?.name || 'Votre commande'} » a été annulée${o.cancelReason ? ` — ${o.cancelReason}` : ''}.`,
  },
};

/**
 * Notify both parties of an order status transition (fire-and-forget:
 * never throws, never blocks the order update).
 *  - Every step → persistent notification for the CLIENT.
 *  - CANCELLED by the client → also tells the WASHER he lost the job.
 *  - COMPLETED → also confirms the WASHER's credited earnings.
 */
export async function notifyOrderStatusChange(
  order: OrderForNotification,
  options: NotifyOptions
): Promise<void> {
  try {
    const clientId = order.client?.id;
    const washerUserId = order.washer?.userId || undefined;
    const serviceName = order.service?.name || '';

    // 1. Client side — every transition (skipped when the client is the actor).
    const clientNotif = CLIENT_STATUS_NOTIFS[order.status];
    if (clientNotif && clientId && options.actorRole !== 'CLIENT') {
      await notify({
        userId: clientId,
        title: clientNotif.title,
        message: clientNotif.message(order),
        type: 'order',
        data: { orderId: order.id, orderNumber: order.orderNumber, status: order.status },
      });
    }

    // 2. Washer side — events that concern him directly.
    if (washerUserId) {
      if (order.status === 'CANCELLED' && options.actorRole === 'CLIENT') {
        await notify({
          userId: washerUserId,
          title: 'Commande annulée ❌',
          message: `« ${serviceName} » a été annulée par le client${order.cancelReason ? ` — ${order.cancelReason}` : ''}.`,
          type: 'order',
          data: { orderId: order.id, orderNumber: order.orderNumber, status: order.status },
        });
      }
      // On ACCEPTED, remind the washer how he gets paid — cash means he has
      // to collect the money on site (payment records are usually created
      // BEFORE acceptance, so this is the first moment washerId exists).
      if (order.status === 'ACCEPTED') {
        const method = (order as { payment?: { method?: string; amount?: number } | null }).payment?.method;
        const amount = (order as { payment?: { method?: string; amount?: number } | null }).payment?.amount;
        // Séance abonnement : la prestation est déjà réglée via l'abonnement
        // du client — le laveur n'a RIEN à encaisser, il sera crédité de sa
        // part partenaire à la validation.
        if (order.isSubscriptionOrder) {
          await notify({
            userId: washerUserId,
            title: 'Séance abonnement 👑',
            message: `Commande ${order.orderNumber} — prestation réglée via l'abonnement du client. Rien à encaisser : votre part vous sera créditée à la fin du lavage.`,
            type: 'payment',
            data: { orderId: order.id, orderNumber: order.orderNumber, method: 'SUBSCRIPTION', amount: 0 },
          });
        } else if (method === 'CASH') {
          await notify({
            userId: washerUserId,
            title: 'Paiement en espèces 💵',
            message: `Commande ${order.orderNumber} — encaissez ${(amount ?? 0).toLocaleString('fr-FR')} XOF en espèces auprès du client à la fin du lavage.`,
            type: 'payment',
            data: { orderId: order.id, orderNumber: order.orderNumber, method: 'CASH', amount },
          });
        } else if (method === 'WALLET') {
          await notify({
            userId: washerUserId,
            title: 'Paiement par portefeuille ✅',
            message: `Commande ${order.orderNumber} — ${(amount ?? 0).toLocaleString('fr-FR')} XOF déjà réglés via le portefeuille. Rien à encaisser.`,
            type: 'payment',
            data: { orderId: order.id, orderNumber: order.orderNumber, method: 'WALLET', amount },
          });
        }
      }
      if (order.status === 'COMPLETED' && typeof options.washerAmount === 'number') {
        const fmt = (n: number) => n.toLocaleString('fr-FR');
        const isCash = options.paymentMethod === 'CASH';
        if (options.isSubscriptionOrder) {
          await notify({
            userId: washerUserId,
            title: 'Séance abonnement validée 💰',
            message: `« ${serviceName} » terminée — séance d'abonnement validée, ${fmt(options.washerAmount)} F ajoutés à vos gains.`,
            type: 'payment',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              amount: options.washerAmount,
              method: 'SUBSCRIPTION',
            },
          });
          return;
        }
        await notify({
          userId: washerUserId,
          title: 'Prestation validée 💰',
          message: isCash
            ? `« ${serviceName} » terminée — ${fmt(options.washerAmount)} XOF encaissés en espèces (rien n'est ajouté à vos gains, vous avez l'argent en main). Commission Socline : ${fmt(options.commissionAmount ?? 0)} XOF à régler depuis votre portefeuille.`
            : `« ${serviceName} » terminée — ${fmt(options.washerAmount)} XOF ajoutés à vos gains.`,
          type: 'payment',
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: options.washerAmount,
            method: options.paymentMethod ?? undefined,
            commissionDue: options.commissionAmount ?? 0,
          },
        });
      }
    }
  } catch (error) {
    // Notifications are best-effort — the order must never fail because of them.
    console.error('[OrderNotifications] Failed:', error);
  }
}
