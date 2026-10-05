// Runtime switch for the realtime (socket.io) layer.
//
// The socket mini-service is a long-lived Node process — it CANNOT run on
// Vercel serverless. For the demo deployment we set
// NEXT_PUBLIC_ENABLE_SOCKET=false and every client falls back to the
// polling refresh paths that already exist (notifications 30s, washer
// orders 10s, wallet 8s during USSD...).
//
// Any other value (or unset, as in local dev / the sandbox) keeps realtime
// enabled — zero behavior change by default.

export function isRealtimeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SOCKET !== 'false';
}
