// WhatsApp provider abstraction for Socline OTP (Meta WhatsApp Cloud API).
//
// Env vars (see .env placeholders):
//   WHATSAPP_TOKEN           — permanent access token (Meta Business → System User)
//   WHATSAPP_PHONE_NUMBER_ID — ID of the WhatsApp Business phone number
//   WHATSAPP_OTP_TEMPLATE    — approved authentication template name (default: socline_otp)
//   WHATSAPP_OTP_LANG        — template language (default: fr)
//   WHATSAPP_OTP_MODE        — "template" (default, business-initiated) | "text"
//                              ("text" = free-form message, only deliverable if the
//                              user messaged us within the last 24h → 100% free)
//   OTP_CHANNEL              — sms | whatsapp | both (used by send-otp, default: sms)
//
// Pricing reminder (Meta, since July 2025): charged per template message
// delivered — authentication templates are the cheapest category; free-form
// replies inside the 24h service window are 100% free.

import { normalizePhone } from './sms';

const WA_TIMEOUT_MS = 10_000;
const GRAPH_VERSION = 'v21.0';

// True when enough env vars are set to attempt a real WhatsApp send.
export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// Log a provider error body server-side (truncated) without leaking it to callers.
function logProviderError(status: number, body: string): void {
  const snippet = body.length > 300 ? `${body.slice(0, 300)}…` : body;
  console.error(`[WhatsApp] error (HTTP ${status}):`, snippet);
}

// Send an OTP via WhatsApp. NEVER throws — failures are logged server-side
// and returned, so a WhatsApp outage can never block the OTP flow.
export async function sendWhatsappOtp(
  phone: string,
  code: string
): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { sent: false, error: 'WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)' };
  }

  // Meta expects the destination WITHOUT the leading "+".
  const to = normalizePhone(phone).replace(/^\+/, '');
  const mode = (process.env.WHATSAPP_OTP_MODE || 'template').trim().toLowerCase();
  const templateName = (process.env.WHATSAPP_OTP_TEMPLATE || 'socline_otp').trim();
  const templateLang = (process.env.WHATSAPP_OTP_LANG || 'fr').trim();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  const post = async (body: unknown): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WA_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res: Response;

    if (mode === 'text') {
      // Free-form message — 100% free but only deliverable inside the 24h
      // customer service window (user must have written to us first).
      res = await post({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: `Votre code Socline est ${code}. Valable 5 minutes.` },
      });
    } else {
      // Business-initiated OTP: approved authentication template.
      // Attempt 1: body param + copy-code button (Meta's standard auth template).
      // Attempt 2 (on template error): body param only, for templates without a button.
      res = await post({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      });
      if (!res.ok) {
        res = await post({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
          },
        });
      }
    }

    const raw = await res.text();
    if (!res.ok) {
      logProviderError(res.status, raw);
      return { sent: false, error: `HTTP ${res.status}` };
    }

    // Meta returns { messages: [{ id: "wamid..." }] } on success.
    let delivered = false;
    try {
      const data = JSON.parse(raw) as { messages?: Array<{ id?: string }> };
      delivered = Array.isArray(data.messages) && data.messages.length > 0;
    } catch {
      // Non-JSON body — treated as not delivered below.
    }
    if (!delivered) {
      logProviderError(res.status, raw);
      return { sent: false, error: 'No message id in response' };
    }
    return { sent: true };
  } catch (error) {
    // Network error, timeout (AbortError) or unexpected failure — never throw.
    console.error('[WhatsApp] send failed:', error);
    return { sent: false, error: 'WhatsApp request failed' };
  }
}
