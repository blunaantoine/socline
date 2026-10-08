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

const API_BASE = 'https://app.paydunya.com/api/v1';

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
  return mode === 'live'
    ? 'https://app.paydunya.com/checkout'
    : 'https://app.paydunya.com/sandbox-checkout';
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

  const res = await fetch(`${API_BASE}/checkout-invoice/create`, {
    method: 'POST',
    headers: buildHeaders(creds),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.status !== 'success' || !data?.token) {
    const detail = data?.response_text || data?.message || `HTTP ${res.status}`;
    throw new Error(`PayDunya : création de la facture impossible (${detail})`);
  }

  const token: string = data.token;
  const checkoutUrl: string =
    data.checkout_url || `${checkoutBaseUrl(creds.mode)}/${token}`;

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
    `${API_BASE}/checkout-invoice/confirm/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: buildHeaders(creds),
    }
  );

  const data = await res.json().catch(() => ({}));

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

  return {
    status,
    amount: typeof data?.total_amount === 'number' ? data.total_amount : undefined,
    receiptUrl: data?.receipt_url ?? undefined,
    paymentMethod: data?.payment_method?.type ?? undefined,
    raw: data,
  };
}
