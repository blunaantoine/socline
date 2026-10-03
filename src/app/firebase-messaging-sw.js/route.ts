import { NextResponse } from 'next/server';
import { firebaseClientConfig, isFirebaseClientConfigured } from '@/lib/firebase';

// Serves the FCM service worker at the root scope: /firebase-messaging-sw.js
// The Firebase config is injected server-side from the NEXT_PUBLIC_FIREBASE_*
// environment variables, so the same file works on any deployment without
// editing code. When Firebase is not configured (local sandbox) we serve a
// harmless stub — the app simply never registers it.

export const dynamic = 'force-dynamic';

const SDK_VERSION = '10.12.5';

export async function GET() {
  const headers = {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-store',
  };

  if (!isFirebaseClientConfigured()) {
    return new NextResponse(
      '// Socline — Firebase push not configured (see VERCEL_DEPLOY.md).\n',
      { headers }
    );
  }

  const js = `/* Socline — FCM service worker (config injected from env). */
importScripts('https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(firebaseClientConfig)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || {};
  var data = payload.data || {};
  self.registration.showNotification(n.title || 'Socline', {
    body: n.body || '',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: data.id ? 'socline-' + data.id : undefined,
    renotify: false,
    data: data
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
`;

  return new NextResponse(js, { headers });
}
