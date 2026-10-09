// Server-side realtime bridge: fire-and-forget server→socket-service emit.
//
// The socket.io mini-service (chat-service, port 3003) exposes a secured
// server-to-server endpoint POST /internal/emit (header x-internal-secret)
// that broadcasts to authenticated rooms:
//   user:<userId> | conversation:<id> | order:<orderId>
//
// emitRealtime NEVER throws and NEVER blocks the API response longer than the
// abort timeout — realtime is best-effort, business logic must not depend on it.

const SOCKET_SERVICE_URL = 'http://127.0.0.1:3003/internal/emit';
const EMIT_TIMEOUT_MS = 3000;
// Valeur de repli IDENTIQUE à celle du chat-service (mini-services/chat-service).
// Sans elle, tout .env sans INTERNAL_SOCKET_SECRET faisait rejeter chaque émission
// serveur→service (403) : plus de suivi temps réel ni de notifications.
const DEFAULT_INTERNAL_SOCKET_SECRET = 'socline-internal-socket-secret';

export function emitRealtime(rooms: string[], event: string, data: unknown): void {
  const secret = process.env.INTERNAL_SOCKET_SECRET || DEFAULT_INTERNAL_SOCKET_SECRET;

  // Best-effort: nothing to emit — stay silent-ish.
  if (rooms.length === 0 || !event) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMIT_TIMEOUT_MS);

  fetch(SOCKET_SERVICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ rooms, event, data }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error(`[Realtime] emit failed: socket-service responded ${res.status}`);
      }
      // Drain the body so the socket is released.
      await res.arrayBuffer().catch(() => undefined);
    })
    .catch((error: unknown) => {
      console.error('[Realtime] emit failed:', error);
    })
    .finally(() => clearTimeout(timeout));
}
