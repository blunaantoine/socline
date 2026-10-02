// SMS provider abstraction for Socline.
//
// Env vars (see .env placeholders):
//   SMS_PROVIDER=africastalking | twilio | http
//   SMS_API_KEY     — Africa's Talking apiKey / Twilio Auth Token
//   SMS_USERNAME    — Africa's Talking username / Twilio Account SID
//   SMS_SENDER_ID   — sender name (e.g. SOCLINE) / Twilio From
//   SMS_WEBHOOK_URL — generic HTTP gateway endpoint (provider=http)
//
// When no provider is configured the app runs in "SMS demo mode": the caller
// (send-otp) decides what to do with that (shows the code in the UI, test only).

const SMS_TIMEOUT_MS = 10_000;

// True when enough env vars are set to attempt a real SMS send.
export function isSmsConfigured(): boolean {
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  switch (provider) {
    case 'africastalking':
      return Boolean(process.env.SMS_API_KEY && process.env.SMS_USERNAME);
    case 'twilio':
      return Boolean(process.env.SMS_API_KEY && process.env.SMS_USERNAME && process.env.SMS_SENDER_ID);
    case 'http':
      return Boolean(process.env.SMS_WEBHOOK_URL);
    default:
      return false;
  }
}

// Light phone normalization for SMS destinations. Keep it simple and predictable:
// - strips spaces, dashes, parentheses and dots
// - "0XXXXXXXX" (Togo local, 8 digits) → "+228XXXXXXXX"
// - "00228..." → "+228..."
// - anything else is returned as-is (assumed already E.164 or provider-acceptable)
export function normalizePhone(phone: string): string {
  const p = phone.replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00228')) return `+228${p.slice(5)}`;
  if (p.startsWith('0') && p.length === 8) return `+228${p.slice(1)}`;
  return p;
}

// fetch() wrapper with a hard timeout so a slow provider can never hang a request.
async function postWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Log a provider error body server-side (truncated) without leaking it to callers.
function logProviderError(provider: string, status: number, body: string): void {
  const snippet = body.length > 300 ? `${body.slice(0, 300)}…` : body;
  console.error(`[SMS] ${provider} error (HTTP ${status}):`, snippet);
}

// Send an SMS. NEVER throws — failures are logged server-side and returned.
export async function sendSms(
  phone: string,
  message: string
): Promise<{ sent: boolean; provider?: string; error?: string }> {
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  if (!provider) {
    return { sent: false, error: 'SMS_PROVIDER not configured' };
  }
  const to = normalizePhone(phone);

  try {
    switch (provider) {
      // Africa's Talking — natural provider for Togo / West Africa.
      case 'africastalking': {
        const apiKey = process.env.SMS_API_KEY;
        const username = process.env.SMS_USERNAME;
        const senderId = process.env.SMS_SENDER_ID;
        if (!apiKey || !username) {
          return { sent: false, error: "Africa's Talking not configured (SMS_API_KEY / SMS_USERNAME)" };
        }

        const params = new URLSearchParams({ username, to, message });
        if (senderId) params.set('from', senderId);

        const res = await postWithTimeout('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: params.toString(),
        });

        const raw = await res.text();
        if (!res.ok) {
          logProviderError(provider, res.status, raw);
          return { sent: false, provider, error: `HTTP ${res.status}` };
        }

        // 2xx: sent only if at least one recipient reports a success status.
        let recipients: Array<{ status?: string; statusCode?: number }> = [];
        try {
          const data = JSON.parse(raw) as {
            SMSMessageData?: { Recipients?: Array<{ status?: string; statusCode?: number }> };
          };
          recipients = data.SMSMessageData?.Recipients ?? [];
        } catch {
          // Non-JSON body — treated as no successful recipient below.
        }
        const sent = recipients.some(
          (r) => (r.status ?? '').toLowerCase() === 'success' || r.statusCode === 101 || r.statusCode === 102
        );
        if (!sent) {
          logProviderError(provider, res.status, raw);
          return { sent: false, provider, error: 'No recipient reported success' };
        }
        return { sent: true, provider };
      }

      // Twilio — SMS_USERNAME = Account SID, SMS_API_KEY = Auth Token.
      case 'twilio': {
        const accountSid = process.env.SMS_USERNAME;
        const authToken = process.env.SMS_API_KEY;
        const from = process.env.SMS_SENDER_ID;
        if (!accountSid || !authToken || !from) {
          return { sent: false, error: 'Twilio not configured (SMS_USERNAME / SMS_API_KEY / SMS_SENDER_ID)' };
        }

        const params = new URLSearchParams({ From: from, To: to, Body: message });
        const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const res = await postWithTimeout(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basic}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        const raw = await res.text();
        if (!res.ok) {
          logProviderError(provider, res.status, raw);
          return { sent: false, provider, error: `HTTP ${res.status}` };
        }
        return { sent: true, provider };
      }

      // Generic JSON gateway: POST { phone, message } to SMS_WEBHOOK_URL.
      case 'http': {
        const url = process.env.SMS_WEBHOOK_URL;
        if (!url) {
          return { sent: false, error: 'HTTP SMS gateway not configured (SMS_WEBHOOK_URL)' };
        }

        const res = await postWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: to, message }),
        });

        const raw = await res.text();
        if (!res.ok) {
          logProviderError(provider, res.status, raw);
          return { sent: false, provider, error: `HTTP ${res.status}` };
        }
        return { sent: true, provider };
      }

      default:
        return { sent: false, error: `Unknown SMS_PROVIDER: ${provider}` };
    }
  } catch (error) {
    // Network error, timeout (AbortError) or unexpected failure — never throw.
    console.error(`[SMS] ${provider} send failed:`, error);
    return { sent: false, provider, error: 'SMS provider request failed' };
  }
}
