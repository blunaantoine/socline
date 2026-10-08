// POST /api/payment/paydunya/webhook
// IPN (Instant Payment Notification) PayDunya.
//
// PayDunya POSTe vers ce URL (callback_url / IPN configuré dans le tableau de
// bord marchand) lorsque le paiement change d'état. Le payload peut être en
// form-urlencoded (champ `token` + `data`) ou JSON selon la version de l'API.
//
// SÉCURITÉ : le payload n'est JAMAIS cru sur parole — on relit le token de la
// facture, puis on reconfirme le statut auprès de l'API PayDunya
// (settlePaydunyaDeposit → confirmPaydunyaInvoice). Idempotent.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settlePaydunyaDeposit } from '@/lib/paydunya-actions';

async function extractToken(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const json = await request.json();
      return json?.token ?? json?.data?.token ?? null;
    } catch {
      return null;
    }
  }

  // form-urlencoded (cas standard PayDunya)
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const token = params.get('token');
    if (token) return token;

    // Certains payloads placent le token dans `data` (JSON stringifié)
    const data = params.get('data');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed?.token ?? null;
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await extractToken(request);

    if (!token) {
      // 200 pour éviter les tentatives infinies de rejeu de PayDunya
      return NextResponse.json({ success: false, message: 'Token absent' });
    }

    // Trouver la transaction correspondant à la facture
    const transaction = await db.walletTransaction.findFirst({
      where: { paydunyaToken: token },
      select: { id: true },
    });

    if (!transaction) {
      console.warn(`[PayDunya IPN] Aucune transaction pour le token ${token}`);
      return NextResponse.json({
        success: false,
        message: 'Transaction correspondante introuvable',
      });
    }

    const result = await settlePaydunyaDeposit(transaction.id);

    return NextResponse.json({
      success: true,
      status: result.settled,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error('[PayDunya IPN] Error:', error);
    // 200 quand même : PayDunya rejouerait sans fin en cas de 5xx,
    // et notre polling client + settle idempotent couvrent déjà le cas.
    return NextResponse.json({ success: false, message: 'Erreur interne' });
  }
}

// GET — contrôle de santé (PayDunya peut vérifier l'URL)
export async function GET() {
  return NextResponse.json({ success: true, service: 'paydunya-webhook' });
}
