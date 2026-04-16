import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders - Get orders (with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const washerId = searchParams.get('washerId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (userId) {
      where.clientId = userId;
    }
    if (washerId) {
      where.washerId = washerId;
    }
    if (status) {
      where.status = status;
    }

    const orders = await db.order.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, phone: true },
        },
        washer: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        service: true,
        station: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.order.count({ where });

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      serviceId,
      isHomeService,
      address,
      latitude,
      longitude,
      stationId,
      scheduledAt,
      promoCode,
    } = body;

    // Validate required fields
    if (!clientId || !serviceId || !address) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get service price
    const service = await db.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found' },
        { status: 404 }
      );
    }

    // Calculate pricing
    let basePrice = service.price;
    let discount = 0;

    // Check promo code if provided
    if (promoCode) {
      const promo = await db.promotion.findFirst({
        where: {
          code: promoCode,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });

      if (promo) {
        if (promo.discountType === 'PERCENTAGE') {
          discount = basePrice * (promo.discountValue / 100);
        } else {
          discount = promo.discountValue;
        }
      }
    }

    const totalPrice = basePrice - discount;
    const commission = totalPrice * 0.15; // 15% commission

    // Generate order number
    const orderNumber = `WG${Date.now().toString().slice(-8)}`;

    // Create order
    const order = await db.order.create({
      data: {
        orderNumber,
        clientId,
        serviceId,
        isHomeService: isHomeService ?? true,
        address,
        latitude,
        longitude,
        stationId,
        basePrice,
        discount,
        totalPrice,
        commission,
        promoCode,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        status: 'PENDING',
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: true,
      },
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
