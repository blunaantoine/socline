import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/promotions - Get all promotions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const active = searchParams.get('active');

    const where: any = {};
    
    if (code) {
      where.code = code;
    }
    if (active === 'true') {
      where.isActive = true;
      where.startDate = { lte: new Date() };
      where.endDate = { gte: new Date() };
    }

    const promotions = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      promotions,
    });
  } catch (error) {
    console.error('Get promotions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get promotions' },
      { status: 500 }
    );
  }
}

// POST /api/promotions - Create new promotion (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      type,
      discountType,
      discountValue,
      code,
      startDate,
      endDate,
      maxUses,
      maxUsesPerUser,
      minOrderAmount,
      targetUserIds,
    } = body;

    if (!name || !discountType || !discountValue || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if code already exists
    if (code) {
      const existing = await db.promotion.findUnique({
        where: { code },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Promo code already exists' },
          { status: 400 }
        );
      }
    }

    const promotion = await db.promotion.create({
      data: {
        name,
        description,
        type: type || 'PROMO_CODE',
        discountType,
        discountValue,
        code,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxUses,
        maxUsesPerUser: maxUsesPerUser || 1,
        minOrderAmount,
        targetUserIds: targetUserIds ? JSON.stringify(targetUserIds) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create promotion' },
      { status: 500 }
    );
  }
}

// POST /api/promotions/validate - Validate promo code
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId, orderAmount } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Promo code is required' },
        { status: 400 }
      );
    }

    const promotion = await db.promotion.findUnique({
      where: { code },
    });

    if (!promotion) {
      return NextResponse.json(
        { success: false, error: 'Invalid promo code' },
        { status: 400 }
      );
    }

    // Check if promotion is active
    const now = new Date();
    if (!promotion.isActive || promotion.startDate > now || promotion.endDate < now) {
      return NextResponse.json(
        { success: false, error: 'Promo code has expired' },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
      return NextResponse.json(
        { success: false, error: 'Promo code usage limit reached' },
        { status: 400 }
      );
    }

    // Check minimum order amount
    if (promotion.minOrderAmount && orderAmount < promotion.minOrderAmount) {
      return NextResponse.json(
        { success: false, error: `Minimum order amount is ${promotion.minOrderAmount} FCFA` },
        { status: 400 }
      );
    }

    // Calculate discount
    let discount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      discount = orderAmount * (promotion.discountValue / 100);
    } else {
      discount = promotion.discountValue;
    }

    return NextResponse.json({
      success: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        discount,
      },
    });
  } catch (error) {
    console.error('Validate promotion error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate promotion' },
      { status: 500 }
    );
  }
}
