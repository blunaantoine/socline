// ---------------------------------------------------------------------------
// Socline — Client API PayDunya (Checkout Invoice, API v1)
//
// Doc : https://developers.paydunya.com
//   1. Créer une facture  : POST /api/v1/checkout-invoice/create
//   2. Vérifier une facture : GET /api/v1/checkout-invoice/confirm/{token}
//
// En-têtes requis :
//   PAYDUNYA-MASTER-KEY  : clé maître du compte marchand
//   PAYDUNYA-PRIVATE-KEY : clé privée (test_private_… ou live_private_…)
//   PAYDUNYA-TOKEN       : token du compte marchand
//
// Le mode (test/live) détermine l'URL de checkout :
//   test → https://app.paydunya.com/sandbox-checkout/{token}
//   live → https://app.paydunya.com/checkout/{token}
// ---------------------------------------------------------------------------

import { getPaymentConfig, type PaydunyaCredentials } from '@/lib/payment-settings';

const API_BASE_LIVE = 'https://app.paydunya.com/api/v1';
const API_BASE_SANDBOX = 'https://app.paydunya.com/sandbox-api/v1';

// PayDunya expose DEUX API distinctes : le sandbox (clés test_…) et le live
// (clés live_…). Utiliser l'API live avec des clés de test renvoie une erreur
// (« Invalid Masterkey Specified » ou « Vous devez valider vos informations de
// KYC… »). L'URL est donc choisie selon le MODE configuré par l'admin.
function apiBaseUrl(mode: PaydunyaCredentials['mode']): string {
  return mode === 'live' ? API_BASE_LIVE : API_BASE_SANDBOX;
}

// URL de base de l'app (surchargeable via NEXT_PUBLIC_APP_URL).
// Sert à construire les URLs IPN / retour / annulation envoyées à PayDunya.
export function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://socline.oquitogo.com';
  return url.replace(/\/+$/, '');
}

export interface PaydunyaInvoice {
  token: string;
  checkoutUrl: string;
  raw?: unknown;
}

export interface PaydunyaConfirmResult {
  status: 'completed' | 'pending' | 'cancelled' | 'failed' | 'unknown';
  amount?: number;
  receiptUrl?: string;
  paymentMethod?: string;
  raw?: unknown;
}

function buildHeaders(creds: PaydunyaCredentials): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'PAYDUNYA-MASTER-KEY': creds.masterKey,
    'PAYDUNYA-PRIVATE-KEY': creds.privateKey,
    'PAYDUNYA-TOKEN': creds.token,
  };
}

function checkoutBaseUrl(mode: PaydunyaCredentials['mode']): string {
  // Format observé sur l'API réelle (sandbox) :
  //   https://paydunya.com/sandbox-checkout/invoice/{token}
  // En live, PayDunya renvoie toujours l'URL dans response_text — ce
  // fallback n'est utilisé qu'en dernier recours.
  return mode === 'live'
    ? 'https://paydunya.com/checkout/invoice'
    : 'https://paydunya.com/sandbox-checkout/invoice';
}

// ---------------------------------------------------------------------------
// Créer une facture de checkout
// ---------------------------------------------------------------------------
export async function createPaydunyaInvoice(params: {
  amount: number;
  description: string;
  customData?: Record<string, string>;
}): Promise<PaydunyaInvoice> {
  const config = await getPaymentConfig();
  const creds = config.paydunya;

  if (!creds.masterKey || !creds.privateKey || !creds.token) {
    throw new Error(
      'PayDunya n\'est pas configuré. L\'administrateur doit renseigner les clés dans le panneau admin.'
    );
  }

  const body: Record<string, unknown> = {
    invoice: {
      total_amount: Math.round(params.amount),
      description: params.description,
    },
    store: {
      name: creds.storeName,
    },
    // URLs PayDunya :
    //   callback_url → IPN (notification serveur-serveur, fiable même si le
    //                  champ IPN du tableau de bord marchand n'est pas activé)
    //   return_url   → le client revient dans l'app (onglet Portefeuille)
    //   cancel_url   → le client revient dans l'app après annulation
    actions: {
      callback_url: `${getAppBaseUrl()}/api/payment/paydunya/webhook`,
      return_url: `${getAppBaseUrl()}/?paydunya=return`,
      cancel_url: `${getAppBaseUrl()}/?paydunya=return`,
    },
  };

  if (params.customData && Object.keys(params.customData).length > 0) {
    body.custom_data = params.customData;
  }

  const res = await fetch(
    `${apiBaseUrl(creds.mode)}/checkout-invoice/create`,
    {
      method: 'POST',
      headers: buildHeaders(creds),
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));

  // FORMAT RÉEL PayDunya (validé sur l'API sandbox) :
  //   { "response_code": "00",
  //     "response_text": "https://paydunya.com/sandbox-checkout/invoice/{token}",
  //     "description": "Checkout Invoice Created.",
  //     "token": "test_…" }
  // → response_code "00" = succès, et response_text EST l'URL de paiement.
  // (on garde la compatibilité avec l'ancien format status:"success"/checkout_url)
  const success = data?.response_code === '00' || data?.status === 'success';
  const token: string | undefined = data?.token;

  if (!res.ok || !success || !token) {
    const detail = data?.response_text || data?.message || `HTTP ${res.status}`;
    throw new Error(`PayDunya : création de la facture impossible (${detail})`);
  }

  // URL de checkout : priorité checkout_url (ancien format) puis response_text
  // (format réel — c'est une URL), sinon fallback construit selon le mode.
  const responseText =
    typeof data?.response_text === 'string' ? data.response_text : '';

  let checkoutUrl: string;
  if (typeof data?.checkout_url === 'string' && data.checkout_url.startsWith('http')) {
    checkoutUrl = data.checkout_url;
  } else if (responseText.startsWith('http')) {
    checkoutUrl = responseText;
  } else {
    checkoutUrl = `${checkoutBaseUrl(creds.mode)}/${token}`;
  }

  return { token, checkoutUrl, raw: data };
}

// ---------------------------------------------------------------------------
// Vérifier le statut d'une facture (source de vérité — on ne fait jamais
// confiance au payload de l'IPN, on reconfirme auprès de PayDunya)
// ---------------------------------------------------------------------------
export async function confirmPaydunyaInvoice(
  token: string
): Promise<PaydunyaConfirmResult> {
  const config = await getPaymentConfig();
  const creds = config.paydunya;

  const res = await fetch(
    `${apiBaseUrl(creds.mode)}/checkout-invoice/confirm/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: buildHeaders(creds),
    }
  );

  const data = await res.json().catch(() => ({}));

  // FORMAT RÉEL PayDunya (validé sur l'API sandbox) :
  //   { "response_code": "00", "response_text": "Transaction Found",
  //     "mode": "test", "status": "pending" | "completed" | "cancelled",
  //     "invoice": { "total_amount": 1000, … },
  //     "custom_data": {…}, "payment_method": {"type": …} (si payé),
  //     "receipt_url": "…" (si payé) }
  if (!res.ok) {
    const detail = data?.response_text || data?.message || `HTTP ${res.status}`;
    throw new Error(`PayDunya : vérification impossible (${detail})`);
  }

  const rawStatus = String(data?.status ?? '').toLowerCase();
  const status: PaydunyaConfirmResult['status'] =
    rawStatus === 'completed'
      ? 'completed'
      : rawStatus === 'pending'
        ? 'pending'
        : rawStatus === 'cancelled'
          ? 'cancelled'
          : rawStatus === 'failed'
            ? 'failed'
            : 'unknown';

  // Le montant est dans invoice.total_amount (ancien format : total_amount racine)
  const rawAmount = data?.invoice?.total_amount ?? data?.total_amount;

  return {
    status,
    amount: typeof rawAmount === 'number' ? rawAmount : undefined,
    receiptUrl: data?.receipt_url ?? undefined,
    paymentMethod: data?.payment_method?.type ?? undefined,
    raw: data,
  };
}
