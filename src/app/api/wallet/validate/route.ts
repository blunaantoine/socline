import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { processDeposit } from '@/lib/wallet-actions';

// POST /api/wallet/validate - Validate or reject a deposit (ADMIN ONLY).
// SECURITY: this endpoint was previously UNAUTHENTICATED (anyone could credit
// any wallet). It now requires an admin session and delegates to the shared
// atomic processor (guarded status flip + crediting inside one transaction).
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { transactionId, action } = body; // action: 'validate' or 'reject'

    if (!transactionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (action !== 'validate' && action !== 'reject') {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    const result = await processDeposit(transactionId, action);

    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'ALREADY_PROCESSED' || result.code === 'NOT_A_DEPOSIT'
            ? 400
            : 500;
      const message =
        result.code === 'NOT_FOUND'
          ? 'Transaction non trouvée'
          : result.code === 'ALREADY_PROCESSED'
            ? 'Transaction déjà traitée'
            : result.code === 'NOT_A_DEPOSIT'
              ? 'Cette transaction n\'est pas un dépôt'
              : result.error || 'Erreur lors de la validation';
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: action === 'validate' ? 'Rechargement validé' : 'Rechargement rejeté',
      wallet: result.wallet,
    });
  } catch (error) {
    console.error('Validate deposit error:', error);
    return NextResponse.json({ error: 'Erreur lors de la validation' }, { status: 500 });
  }
}
