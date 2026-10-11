// GET  /api/admin/payment-config — lire la configuration du système de paiement
// POST /api/admin/payment-config — choisir le système actif + configurer PayDunya
// Accès : admin uniquement.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getPaymentConfig,
  setPaymentConfig,
  maskSecret,
  type PaymentProvider,
  type PaydunyaMode,
} from '@/lib/payment-settings';

// GET — renvoie la config complète (clés masquées pour l'affichage admin)
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response!;

  try {
    const config = await getPaymentConfig();

    return NextResponse.json({
      success: true,
      provider: config.provider,
      paydunyaConfigured: config.paydunyaConfigured,
      paydunya: {
        mode: config.paydunya.mode,
        storeName: config.paydunya.storeName,
        masterKey: maskSecret(config.paydunya.masterKey),
        privateKey: maskSecret(config.paydunya.privateKey),
        token: maskSecret(config.paydunya.token),
        hasMasterKey: Boolean(config.paydunya.masterKey),
        hasPrivateKey: Boolean(config.paydunya.privateKey),
        hasToken: Boolean(config.paydunya.token),
      },
    });
  } catch (error) {
    console.error('Get admin payment config error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture de la configuration' },
      { status: 500 }
    );
  }
}

// POST — sauvegarde : { provider?, paydunya?: { mode?, masterKey?, privateKey?, token?, storeName? } }
// Les champs clés sont optionnels : une valeur vide NE supprime pas la clé
// existante (on ne renvoie jamais la clé réelle au navigateur, donc un champ
// laissé masqué ne doit pas écraser la valeur en base).
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response!;

  try {
    const body = await request.json();
    const { provider, paydunya } = body;

    if (provider && provider !== 'MIXX_USSD' && provider !== 'PAYDUNYA') {
      return NextResponse.json(
        { success: false, error: 'Système de paiement invalide' },
        { status: 400 }
      );
    }

    const paydunyaInput: Record<string, string | PaydunyaMode> = {};

    if (paydunya) {
      if (paydunya.mode) {
        paydunyaInput.mode = paydunya.mode === 'live' ? 'live' : 'test';
      }
      if (typeof paydunya.storeName === 'string' && paydunya.storeName.trim()) {
        paydunyaInput.storeName = paydunya.storeName.trim();
      }
      // Clés : on n'écrase que si une valeur NON masquée et non vide est fournie
      for (const field of ['masterKey', 'privateKey', 'token'] as const) {
        const value = paydunya[field];
        if (typeof value === 'string' && value.trim() && !value.includes('••••')) {
          paydunyaInput[field] = value.trim();
        }
      }
    }

    await setPaymentConfig({
      provider: provider as PaymentProvider | undefined,
      paydunya: Object.keys(paydunyaInput).length > 0 ? paydunyaInput : undefined,
    });

    // Relecture pour renvoyer l'état réel après sauvegarde
    const config = await getPaymentConfig();

    return NextResponse.json({
      success: true,
      message: 'Configuration de paiement enregistrée',
      provider: config.provider,
      paydunyaConfigured: config.paydunyaConfigured,
    });
  } catch (error) {
    console.error('Save admin payment config error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde de la configuration' },
      { status: 500 }
    );
  }
}
