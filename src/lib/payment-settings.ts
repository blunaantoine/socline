// ---------------------------------------------------------------------------
// Socline — Réglages du système de paiement (table `settings`, clé/valeur)
//
// L'administrateur choisit depuis le panneau admin quel système de paiement
// est affiché aux clients :
//   - MIXX_USSD : paiement via le composeur USSD (Mixx by Yas / Flooz),
//     validation manuelle par l'admin dans « Demandes de recharge ».
//   - PAYDUNYA  : paiement en ligne via la page de checkout PayDunya
//     (T-Money, Moov Money, Wave…), validation AUTOMATIQUE.
//
// Les clés PayDunya sont stockées en base (visibles/masquées uniquement par
// l'admin). Aucune clé ne quitte le backend : l'endpoint public ne renvoie
// jamais les secrets.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';

export type PaymentProvider = 'MIXX_USSD' | 'PAYDUNYA';
export type PaydunyaMode = 'test' | 'live';

export interface PaydunyaCredentials {
  mode: PaydunyaMode;
  masterKey: string;
  privateKey: string;
  token: string;
  storeName: string;
}

export interface PaymentConfig {
  provider: PaymentProvider;
  paydunya: PaydunyaCredentials;
  paydunyaConfigured: boolean;
}

// Clés de la table settings
export const SETTING_KEYS = {
  provider: 'payment_provider',
  paydunyaMode: 'paydunya_mode',
  paydunyaMasterKey: 'paydunya_master_key',
  paydunyaPrivateKey: 'paydunya_private_key',
  paydunyaToken: 'paydunya_token',
  paydunyaStoreName: 'paydunya_store_name',
} as const;

// Lire une setting (retourne null si absente)
async function readSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

// Écrire une setting (upsert) — description conservée à la création
export async function writeSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: description ?? null },
  });
}

// ---------------------------------------------------------------------------
// Lecture de la configuration complète (backend uniquement)
// ---------------------------------------------------------------------------
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const [provider, mode, masterKey, privateKey, token, storeName] =
    await Promise.all([
      readSetting(SETTING_KEYS.provider),
      readSetting(SETTING_KEYS.paydunyaMode),
      readSetting(SETTING_KEYS.paydunyaMasterKey),
      readSetting(SETTING_KEYS.paydunyaPrivateKey),
      readSetting(SETTING_KEYS.paydunyaToken),
      readSetting(SETTING_KEYS.paydunyaStoreName),
    ]);

  const paydunya: PaydunyaCredentials = {
    mode: mode === 'live' ? 'live' : 'test',
    masterKey: masterKey ?? '',
    privateKey: privateKey ?? '',
    token: token ?? '',
    storeName: storeName || 'Socline',
  };

  const paydunyaConfigured =
    Boolean(paydunya.masterKey) &&
    Boolean(paydunya.privateKey) &&
    Boolean(paydunya.token);

  return {
    provider: provider === 'PAYDUNYA' ? 'PAYDUNYA' : 'MIXX_USSD',
    paydunya,
    paydunyaConfigured,
  };
}

// ---------------------------------------------------------------------------
// Écriture de la configuration (admin)
// ---------------------------------------------------------------------------
export async function setPaymentConfig(input: {
  provider?: PaymentProvider;
  paydunya?: Partial<PaydunyaCredentials>;
}): Promise<void> {
  if (input.provider) {
    await writeSetting(
      SETTING_KEYS.provider,
      input.provider,
      'Système de paiement affiché aux clients (MIXX_USSD | PAYDUNYA)'
    );
  }

  const p = input.paydunya;
  if (!p) return;

  if (p.mode) {
    await writeSetting(
      SETTING_KEYS.paydunyaMode,
      p.mode === 'live' ? 'live' : 'test',
      'Mode PayDunya (test | live)'
    );
  }
  if (typeof p.masterKey === 'string') {
    await writeSetting(SETTING_KEYS.paydunyaMasterKey, p.masterKey, 'Clé maître PayDunya');
  }
  if (typeof p.privateKey === 'string') {
    await writeSetting(SETTING_KEYS.paydunyaPrivateKey, p.privateKey, 'Clé privée PayDunya');
  }
  if (typeof p.token === 'string') {
    await writeSetting(SETTING_KEYS.paydunyaToken, p.token, 'Token PayDunya');
  }
  if (typeof p.storeName === 'string' && p.storeName.trim()) {
    await writeSetting(SETTING_KEYS.paydunyaStoreName, p.storeName.trim(), 'Nom de boutique PayDunya');
  }
}

// Masquer une clé pour l'affichage admin (garde le préfixe + 4 derniers)
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}
