// Shared, in-memory dedup for realtime notifications.
//
// One notification can reach the UI through TWO channels at the same time:
//   - the socket (mini-service, 'notification' event), and
//   - an FCM push (foreground onMessage handler).
// Both paths call markSeen(id): only the first one toasts, while the
// window rebroadcast (`socline:notification`) stays dedup-safe for list
// updates which already ignore duplicate ids.

const seen = new Map<string, number>();
const TTL_MS = 60_000;

export function markSeen(id: string): boolean {
  if (!id) return true;
  const now = Date.now();

  for (const [key, ts] of seen) {
    if (now - ts > TTL_MS) seen.delete(key);
  }

  if (seen.has(id)) return false;
  seen.set(id, now);
  return true;
}
