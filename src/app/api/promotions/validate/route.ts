import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { validatePromotionCode } from '@/lib/promo';

// POST /api/promotions/validate - Validate a promo code (client-side preview).
//
// The FINAL discount is always recomputed server-side in POST /api/orders;
// this endpoint is only a preview so the UI can display the discount before
// the order is created. Identity comes from the session (body userId ignored)
// and the same business rules as the order creation are enforced.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }

    const body = await request.json();
    const { code, orderAmount } = body;

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Code promo requis'
      }, { status: 400 });
    }

    const result = await validatePromotionCode(code, auth.user.id, Number(orderAmount) || 0);

    if (!result.valid) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      promotion: result.promotion,
    });
  } catch (error) {
    console.error('Validate promotion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur lors de la validation du code promo'
    }, { status: 500 });
  }
}
