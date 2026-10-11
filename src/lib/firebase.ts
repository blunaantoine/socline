// Firebase Cloud Messaging — CLIENT side (demo mode).
//
// All config comes from NEXT_PUBLIC_FIREBASE_* environment variables (they
// are public by design — Firebase web keys are not secrets). When they are
// missing (local sandbox, no Firebase project yet) every helper degrades
// gracefully: push stays disabled, everything else keeps working.

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseClientConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const firebaseVapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    firebaseClientConfig.apiKey &&
      firebaseClientConfig.projectId &&
      firebaseClientConfig.appId
  );
}

export type PushEnableResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not-configured' | 'unsupported' | 'permission-denied' | 'server' | 'error' };

// Full registration flow:
//   1. ask notification permission,
//   2. register the app-served service worker (/firebase-messaging-sw.js),
//   3. get the FCM token,
//   4. persist it on the session user (POST /api/notifications/register-token).
export async function enablePushNotifications(): Promise<PushEnableResult> {
  if (!isFirebaseClientConfigured()) return { ok: false, reason: 'not-configured' };

  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('Notification' in window)
  ) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };

    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );
    await navigator.serviceWorker.ready;

    const [{ initializeApp }, messagingMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);

    const app = initializeApp(firebaseClientConfig);
    const messaging = messagingMod.getMessaging(app);
    const token = await messagingMod.getToken(messaging, {
      vapidKey: firebaseVapidKey || undefined,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, reason: 'error' };

    const res = await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return { ok: false, reason: 'server' };

    return { ok: true, token };
  } catch (error) {
    console.warn('[Firebase] enablePushNotifications failed:', error);
    return { ok: false, reason: 'error' };
  }
}

// Foreground push listener — only meaningful once push is enabled.
export async function onForegroundPush(
  handler: (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => void
): Promise<() => void> {
  if (!isFirebaseClientConfigured() || typeof window === 'undefined') {
    return () => {};
  }
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return () => {};
  }

  try {
    if (Notification.permission !== 'granted') return () => {};

    const [{ initializeApp }, messagingMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    const app = initializeApp(firebaseClientConfig);
    const messaging = messagingMod.getMessaging(app);
    return messagingMod.onMessage(messaging, handler);
  } catch (error) {
    console.warn('[Firebase] onForegroundPush init failed:', error);
    return () => {};
  }
}
