// Centralized notification service — the ONE way to notify a user.
//
// Every notification is:
//   1. Persisted in the DB (source of truth, served by GET /api/notifications)
//   2. Pushed in real time to the user's socket room (`user:<userId>`) as a
//      'notification' event — the RealtimeNotifications component shows an
//      instant toast and re-broadcasts to the app via the window event
//      `socline:notification` (WalletScreen / WasherApp listen to refresh).
//   3. Optionally sent as an FCM PUSH (Firebase — demo project) when the
//      server credentials are set and the user registered a device token.
//   4. Optionally sent as SMS for critical events (deposit validated,
//      withdrawal approved/rejected...) — best-effort, never blocking.
//
// notify() NEVER throws: business logic must not fail because of a
// notification problem.

import { db } from '@/lib/db';
import { emitRealtime } from '@/lib/realtime';
import { sendSms } from '@/lib/sms';
import { isPushConfigured, sendPushToToken } from '@/lib/firebase-admin';

export interface NotifyInput {
  userId: string;
  title: string;
  message: string;
  // Loose string kept for backward compatibility with existing types:
  // 'order' | 'message' | 'payment' | 'promo' | 'system' | 'NEW_ORDER' | ...
  type: string;
  data?: Record<string, unknown>;
  // Critical events only — SMS is best-effort (same provider as the OTP).
  sms?: {
    phone: string;
    text: string;
  };
}

export async function notify(input: NotifyInput): Promise<void> {
  // 1. Persist (source of truth).
  try {
    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        data: input.data ? JSON.stringify(input.data) : null,
      },
    });

    // 2. Realtime push to the user's personal room (best-effort).
    emitRealtime(['user:' + input.userId], 'notification', {
      id: notification.id,
      type: input.type,
      title: input.title,
      message: input.message,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
      data: input.data ?? null,
    });

    // 3. FCM push (Firebase — demo) to every registered device (best-effort).
    if (isPushConfigured()) {
      const pushUser = await db.user.findUnique({
        where: { id: input.userId },
        select: { fcmToken: true },
      });
      if (pushUser?.fcmToken) {
        const sent = await sendPushToToken(pushUser.fcmToken, {
          title: input.title,
          body: input.message,
          data: {
            id: notification.id,
            type: input.type,
            createdAt: notification.createdAt.toISOString(),
            ...(input.data ?? {}),
          },
        });
        if (!sent) console.warn('[Notify] FCM push not delivered');
      }
    }
  } catch (error) {
    console.error('[Notify] In-app notification failed:', error);
  }

  // 4. SMS for critical events (best-effort, independent of the DB result).
  if (input.sms?.phone && input.sms?.text) {
    try {
      const result = await sendSms(input.sms.phone, input.sms.text);
      if (!result.sent) {
        console.warn('[Notify] SMS not sent:', result.error);
      }
    } catch (error) {
      console.warn('[Notify] SMS error:', error);
    }
  }
}
