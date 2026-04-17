import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders/[id] - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await db.order.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        washer: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        service: true,
        station: true,
        payment: true,
        review: true,
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get order' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, washerId, cancelReason } = body;

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      
      // Set timestamps based on status
      if (status === 'ACCEPTED') updateData.acceptedAt = new Date();
      if (status === 'EN_ROUTE') updateData.startedAt = new Date();
      if (status === 'ARRIVED') updateData.arrivedAt = new Date();
      if (status === 'IN_PROGRESS') updateData.startedAt = new Date();
      if (status === 'COMPLETED') updateData.completedAt = new Date();
      if (status === 'CANCELLED') {
        updateData.cancelledAt = new Date();
        updateData.cancelReason = cancelReason;
      }
    }

    if (washerId) {
      updateData.washerId = washerId;
    }

    const order = await db.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        washer: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        service: true,
      },
    });

    // Create tracking event
    if (status) {
      await db.trackingEvent.create({
        data: {
          orderId: params.id,
          event: status,
          message: `Order status changed to ${status}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
