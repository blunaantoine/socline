/**
 * Rappels automatiques des rendez-vous planifiés (option C).
 *
 * Les commandes « Plus tard » acceptées par un laveur génèrent une
 * notification client + laveur dans les 2 heures précédant le rendez-vous
 * (fenêtre H-2h, vérifiée toutes les 60 s). Le marqueur `reminderSentAt`
 * empêche tout double envoi.
 *
 * Le scheduler vit dans le process serveur Next (instrumentation.ts) : il
 * démarre une seule fois par process, survit aux redéploiements (systemd
 * redémarre socline-web) et n'ajoute aucune infrastructure.
 */
import { db } from '@/lib/db';
import { notify } from '@/lib/notify';
import { formatScheduledLong } from '@/lib/scheduled';

const CHECK_INTERVAL_MS = 60_000;
const LEAD_TIME_MS = 2 * 60 * 60_000; // rappel envoyé jusqu'à 2 h avant le RDV

let started = false;

export function startReminderScheduler(): void {
  if (started) return;
  started = true;

  // Garde-fou global : HMR/dev peut recharger ce module — un seul timer max.
  const g = globalThis as unknown as { __soclineReminderTimer?: ReturnType<typeof setInterval> };
  if (g.__soclineReminderTimer) return;

  g.__soclineReminderTimer = setInterval(() => {
    void sendDueReminders();
  }, CHECK_INTERVAL_MS);

  // Ne bloque pas l'arrêt du process si le timer traîne.
  if (typeof g.__soclineReminderTimer.unref === 'function') {
    g.__soclineReminderTimer.unref();
  }

  console.log('[Reminders] Scheduler des rendez-vous planifiés démarré (fenêtre H-2h, tick 60 s)');
}

async function sendDueReminders(): Promise<void> {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + LEAD_TIME_MS);

    const orders = await db.order.findMany({
      where: {
        status: 'ACCEPTED',
        scheduledAt: { gte: now, lte: windowEnd },
        reminderSentAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        scheduledAt: true,
        address: true,
        service: { select: { name: true } },
        client: { select: { id: true, name: true, phone: true } },
        washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
      },
    });

    if (orders.length === 0) return;

    for (const order of orders) {
      const when = formatScheduledLong(order.scheduledAt);
      if (!when) continue;
      const serviceName = order.service?.name || 'lavage';
      const address = order.address || 'adresse convenue';
      const washerName = order.washer?.user?.name || 'Votre laveur';
      const clientName = order.client?.name || 'le client';

      // Notification client.
      await notify({
        userId: order.client.id,
        title: 'Rappel de votre rendez-vous 🔔',
        message: `Votre lavage « ${serviceName} » est prévu ${when}. ${washerName} passera à : ${address}.`,
        type: 'order',
        data: { orderId: order.id, orderNumber: order.orderNumber, kind: 'SCHEDULED_REMINDER' },
      });

      // Notification laveur (userId porté par la ligne washer).
      const washerUserId = order.washer?.user?.id;
      if (washerUserId) {
        await notify({
          userId: washerUserId,
          title: 'Rappel : lavage planifié 🔔',
          message: `Lavage « ${serviceName} » prévu ${when} chez ${clientName} (${address}). Préparez votre matériel.`,
          type: 'order',
          data: { orderId: order.id, orderNumber: order.orderNumber, kind: 'SCHEDULED_REMINDER' },
        });
      }

      await db.order.update({
        where: { id: order.id },
        data: { reminderSentAt: new Date() },
      });

      console.log(`[Reminders] Rappels envoyés pour la commande ${order.orderNumber} (RDV ${when})`);
    }
  } catch (error) {
    // Jamais bloquant : le tick suivant réessaiera (reminderSentAt encore null).
    console.error('[Reminders] Erreur du tick de rappel :', error);
  }
}
