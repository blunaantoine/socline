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

export interface OrderForNotification {
  id: string;
  orderNumber: string;
  status: string;
  address?: string | null;
  cancelReason?: string | null;
  service?: { name?: string } | null;
  client?: { id: string } | null;
  washer?: { userId?: string | null; user?: { id: string; name?: string } | null } | null;
}

interface NotifyOptions {
  // Who triggered the transition — used to avoid notifying the actor about
  // their own action (e.g. the client who just cancelled their order).
  actorRole: 'WASHER' | 'CLIENT' | 'ADMIN';
  // Washer payout credited at COMPLETED (totalPrice - frozen commission),
  // only used for the washer-side "earnings credited" notification.
  washerAmount?: number;
}

const CLIENT_STATUS_NOTIFS: Record<
  string,
  { title: string; message: (order: OrderForNotification) => string }
> = {
  ACCEPTED: {
    title: 'Commande acceptée ✅',
    message: (o) =>
      `${o.washer?.user?.name || 'Votre laveur'} a accepté votre commande « ${o.service?.name || ''} ».`,
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
    message: (o) => `« ${o.service?.name || 'Votre lavage'} » est terminé. Merci de votre confiance !`,
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

    // 2. Washer side — only on the two events that concern him directly.
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
      if (order.status === 'COMPLETED' && typeof options.washerAmount === 'number') {
        await notify({
          userId: washerUserId,
          title: 'Prestation validée 💰',
          message: `« ${serviceName} » terminée — ${options.washerAmount.toLocaleString('fr-FR')} XOF ajoutés à vos gains.`,
          type: 'payment',
          data: { orderId: order.id, orderNumber: order.orderNumber, amount: options.washerAmount },
        });
      }
    }
  } catch (error) {
    // Notifications are best-effort — the order must never fail because of them.
    console.error('[OrderNotifications] Failed:', error);
  }
}
