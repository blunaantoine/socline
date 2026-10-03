'use client';

// REAL push notification activation (Firebase Cloud Messaging — demo mode).
//
// Replaces the old fake "Switch defaultChecked" demo toggles: this component
// actually asks for the browser permission, registers the FCM service
// worker, obtains a device token and stores it on the session user via
// POST /api/notifications/register-token. It also listens to FOREGROUND
// pushes and rebroadcasts them through the shared app event (deduped
// against the socket channel by notif-dedup).

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  enablePushNotifications,
  isFirebaseClientConfigured,
  onForegroundPush,
} from '@/lib/firebase';
import { markSeen } from '@/lib/notif-dedup';
import { SOCLINE_NOTIFICATION_EVENT } from '@/components/RealtimeNotifications';

type Status =
  | 'checking'
  | 'unconfigured'
  | 'unsupported'
  | 'denied'
  | 'off'
  | 'enabling'
  | 'enabled';

interface PushNotificationSetupProps {
  title?: string;
  description?: string;
  className?: string;
}

export function PushNotificationSetup({
  title = 'Notifications push',
  description = 'Recevoir les alertes Socline même application fermée',
  className = '',
}: PushNotificationSetupProps) {
  const [status, setStatus] = useState<Status>('checking');

  // Initial state + quiet re-registration when permission is already
  // granted (FCM tokens rotate — registering twice is harmless).
  useEffect(() => {
    let cancelled = false;
    const finish = (next: Status) => {
      if (!cancelled) setStatus(next);
    };

    const run = async () => {
      // Microtask boundary: keep the effect body free of sync setState.
      await Promise.resolve();

      if (!isFirebaseClientConfigured()) return finish('unconfigured');
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('Notification' in window)
      ) {
        return finish('unsupported');
      }

      const permission = Notification.permission;
      if (permission === 'denied') return finish('denied');

      if (permission === 'granted') {
        const res = await enablePushNotifications().catch(() => null);
        return finish(res?.ok ? 'enabled' : 'off');
      }

      finish('off');
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Foreground pushes → instant toast + app-wide rebroadcast.
  useEffect(() => {
    let cancelled = false;
    let off: () => void = () => {};

    onForegroundPush((payload) => {
      const id = payload.data?.id || `fcm-${Date.now()}`;
      const pushTitle = payload.notification?.title || 'Socline';
      const message = payload.notification?.body || '';

      // Only the first channel to deliver this notification toasts
      // (the socket handler uses the same markSeen guard).
      if (markSeen(id)) {
        toast(pushTitle, { description: message });
      }

      try {
        window.dispatchEvent(
          new CustomEvent(SOCLINE_NOTIFICATION_EVENT, {
            detail: {
              id,
              type: payload.data?.type || 'system',
              title: pushTitle,
              message,
              isRead: false,
              createdAt: payload.data?.createdAt || new Date().toISOString(),
            },
          })
        );
      } catch {
        // Non-fatal (very old browsers).
      }
    }).then((fn) => {
      if (cancelled) fn();
      else off = fn;
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const handleEnable = async () => {
    setStatus('enabling');
    const res = await enablePushNotifications();
    if (res.ok) {
      setStatus('enabled');
      toast('Notifications push activées 🔔', {
        description: 'Vous recevrez les alertes Socline même app fermée.',
      });
      return;
    }
    switch (res.reason) {
      case 'permission-denied':
        setStatus('denied');
        break;
      case 'not-configured':
        setStatus('unconfigured');
        break;
      case 'unsupported':
        setStatus('unsupported');
        break;
      default:
        setStatus('off');
        toast("Impossible d'activer le push", {
          description: 'Vérifiez votre connexion et réessayez.',
        });
    }
  };

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center flex-shrink-0">
          {status === 'enabled' ? (
            <BellRing className="w-5 h-5 text-[#4CAF50]" />
          ) : (
            <Bell className="w-5 h-5 text-[#FF9800]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#212121] text-sm">{title}</p>
          <p className="text-xs text-[#757575]">
            {status === 'checking' && 'Vérification…'}
            {status === 'unconfigured' &&
              'Non configuré (démo) — clés Firebase requises'}
            {status === 'unsupported' && 'Non supporté sur cet appareil'}
            {status === 'denied' &&
              'Bloqué — autorisez les notifications dans votre navigateur'}
            {status === 'off' && description}
            {status === 'enabling' && 'Activation…'}
            {status === 'enabled' && 'Activées — vous recevrez les alertes ✅'}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0">
        {status === 'off' && (
          <Button
            size="sm"
            onClick={handleEnable}
            className="bg-[#FF9800] hover:bg-[#F57C00] text-white"
          >
            Activer
          </Button>
        )}
        {(status === 'checking' || status === 'enabling') && (
          <Loader2 className="w-5 h-5 text-[#FF9800] animate-spin" />
        )}
        {status === 'unconfigured' && (
          <BellOff className="w-5 h-5 text-[#BDBDBD]" />
        )}
      </div>
    </div>
  );
}
