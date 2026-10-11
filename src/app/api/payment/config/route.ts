// GET /api/payment/config
// Configuration de paiement PUBLIQUE (consommée par l'écran Portefeuille).
// Ne renvoie JAMAIS les clés PayDunya — seulement le système actif et son
// état de configuration, pour que le client affiche le bon flux.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPaymentConfig } from '@/lib/payment-settings';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const config = await getPaymentConfig();

    return NextResponse.json({
      success: true,
      provider: config.provider,
      paydunyaConfigured: config.paydunyaConfigured,
      paydunyaStoreName: config.paydunya.storeName,
    });
  } catch (error) {
    console.error('Get payment config error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture de la configuration de paiement' },
      { status: 500 }
    );
  }
}
