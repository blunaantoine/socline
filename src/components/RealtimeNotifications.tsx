'use client';

// Global realtime notification listener.
//
// Mounted once in the root layout. Connects an authenticated socket to the
// mini-service, joins the user's personal room and listens for 'notification'
// events pushed by the centralized notify() service. On each event it:
//   1. shows an instant toast (sonner),
//   2. re-broadcasts a `socline:notification` CustomEvent on window —
//      NotificationCenter (badge), WalletScreen (balance) and WasherApp
//      (withdrawals) listen to it and refresh themselves.
//
// The socket reconnects automatically when the auth token changes (login /
// logout) and on network drops.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';
import { isRealtimeEnabled } from '@/lib/realtime-flag';
import type { Socket } from 'socket.io-client';

export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown> | null;
}

export const SOCLINE_NOTIFICATION_EVENT = 'socline:notification';

export function RealtimeNotifications() {
  // Reactive token: the effect re-runs on login/logout.
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      // Logged out — drop any existing connection.
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    let cancelled = false;

    const init = async () => {
      // Serverless demo (Vercel): the socket mini-service cannot run there.
      if (!isRealtimeEnabled()) return;

      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;

        const socket = io('/?XTransformPort=3003', {
          transports: ['websocket'],
          reconnection: true,
          auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          // Join the user's personal room — identity forced from the JWT
          // server-side (any client payload is ignored).
          socket.emit('join');
        });

        socket.on('notification', (payload: RealtimeNotification) => {
          if (!payload?.id) return;

          // 1. Instant toast.
          if (payload.title || payload.message) {
            toast(payload.title || 'Notification', {
              description: payload.message,
            });
          }

          // 2. App-wide rebroadcast.
          try {
            window.dispatchEvent(
              new CustomEvent(SOCLINE_NOTIFICATION_EVENT, { detail: payload })
            );
          } catch {
            // Non-fatal (e.g. very old browsers).
          }
        });
      } catch (error) {
        console.warn('[RealtimeNotifications] init failed:', error);
      }
    };

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return null;
}

// Small helper for consumers that want to subscribe to the app-wide event.
export function onSoclineNotification(
  handler: (notification: RealtimeNotification) => void
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<RealtimeNotification>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(SOCLINE_NOTIFICATION_EVENT, listener);
  return () => window.removeEventListener(SOCLINE_NOTIFICATION_EVENT, listener);
}
