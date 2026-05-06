import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/promotions/validate - Validate a promo code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId, orderAmount } = body;

    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Code promo requis' 
      }, { status: 400 });
    }

    const now = new Date();

    // Find the promotion
    const promotion = await db.promotion.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (!promotion) {
      return NextResponse.json({ 
        success: false, 
        error: 'Code promo invalide ou expiré' 
      }, { status: 400 });
    }

    // Check max uses
    if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ce code promo a atteint sa limite d\'utilisation' 
      }, { status: 400 });
    }

    // Check min order amount
    if (promotion.minOrderAmount && orderAmount < promotion.minOrderAmount) {
      return NextResponse.json({ 
        success: false, 
        error: `Montant minimum: ${promotion.minOrderAmount.toLocaleString()} XOF` 
      }, { status: 400 });
    }

    // Check max uses per user (would need to track user usage in production)
    // For now, we'll just check if the user has used this code before
    if (userId) {
      // In a real app, you'd check a PromotionUsage table
      // For now, we'll skip this check
    }

    // Calculate discount
    let discountAmount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      discountAmount = (orderAmount * promotion.discountValue) / 100;
    } else {
      discountAmount = promotion.discountValue;
    }

    return NextResponse.json({
      success: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        discountAmount,
      },
    });
  } catch (error) {
    console.error('Validate promotion error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur lors de la validation du code promo' 
    }, { status: 500 });
  }
}
