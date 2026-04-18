import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/orders - Get all orders with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = {
      ...(status !== 'all' && { status: status as any }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search } },
          { client: { name: { contains: search } } },
          { client: { phone: { contains: search } } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          washer: {
            include: { user: { select: { name: true, phone: true } } },
          },
          service: { select: { name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.client?.name || 'N/A',
        clientId: o.clientId,
        clientPhone: o.client?.phone,
        washer: o.washer?.user?.name || '-',
        washerId: o.washerId,
        service: o.service?.name || 'N/A',
        amount: o.totalPrice,
        status: o.status,
        createdAt: o.createdAt,
        address: o.address,
        paymentStatus: 'PENDING', // Would need to fetch from Payment table
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/orders - Update order status or assign washer
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, washerId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'ID commande requis' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (washerId) {
      const washer = await db.washer.findUnique({ where: { id: washerId } });
      if (washer) updateData.washerId = washerId;
    }

    const order = await db.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        client: { select: { name: true, phone: true } },
        washer: { include: { user: { select: { name: true } } } },
        service: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
