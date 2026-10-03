// Firebase Cloud Messaging — SERVER side (demo mode).
//
// Sends real push notifications to user devices through FCM HTTP v1.
// Configuration is read from environment variables so the same code runs:
//   - locally / in the sandbox: no Firebase env vars → push silently
//     disabled (in-app + socket notifications keep working),
//   - on Vercel (demo): FIREBASE_SERVICE_ACCOUNT (or the 3 split vars) set
//     → every notify() also wakes the user's device.
//
// NEVER throws: push is best-effort and must not break business logic.

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

interface PushPayload {
  title: string;
  body: string;
  // All values will be stringified (FCM data payload only accepts strings).
  data?: Record<string, unknown>;
}

let appInstance: App | null = null;
let messagingInstance: Messaging | null = null;
let initFailed = false;
let warnedNotConfigured = false;

interface AdminCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Accepts either a full service-account JSON (raw or base64) in
// FIREBASE_SERVICE_ACCOUNT, or the three split variables.
function getCredentials(): AdminCredentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const json = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(json) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          // Private keys pasted in dashboards often keep literal "\n".
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Invalid JSON — fall through to split vars.
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

export function isPushConfigured(): boolean {
  return getCredentials() !== null;
}

function getMessagingOnce(): Messaging | null {
  if (initFailed) return null;
  if (messagingInstance) return messagingInstance;

  const creds = getCredentials();
  if (!creds) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn(
        '[FirebaseAdmin] Push désactivé — aucune clé Firebase (FIREBASE_SERVICE_ACCOUNT). ' +
          'Les notifications restent in-app + temps réel. Voir VERCEL_DEPLOY.md.'
      );
    }
    return null;
  }

  try {
    appInstance =
      getApps().find((a) => a.name === 'socline-push') ??
      initializeApp(
        {
          credential: cert({
            projectId: creds.projectId,
            clientEmail: creds.clientEmail,
            privateKey: creds.privateKey,
          }),
        },
        'socline-push'
      );
    messagingInstance = getMessaging(appInstance);
    return messagingInstance;
  } catch (error) {
    initFailed = true;
    console.warn('[FirebaseAdmin] Init failed — push disabled:', error);
    return null;
  }
}

// Send one push to a device token. Returns true when FCM accepted it.
export async function sendPushToToken(
  token: string,
  payload: PushPayload
): Promise<boolean> {
  const messaging = getMessagingOnce();
  if (!messaging || !token) return false;

  const data: Record<string, string> = { source: 'socline' };
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    if (value != null) data[key] = String(value);
  }

  try {
    await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data,
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    });
    return true;
  } catch (error) {
    // Throttle the noise: a dead token or a disabled API should not spam logs.
    console.warn(
      '[FirebaseAdmin] Push send failed:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
