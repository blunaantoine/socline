import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders/[id] - Get single order
// NOTE: migrated to Next 16 async params (was sync params — pre-existing bug:
// params.id was undefined at runtime, making GET 500 and PATCH unusable).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
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

    // Fetch the current order state (previous status + pricing)
    // needed for the COMPLETED washer credit logic
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, totalPrice: true, commission: true, washerId: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Credit the washer when the order transitions to COMPLETED
    // (only if its previous status was not already COMPLETED — anti double-credit)
    const isCompletion = status === 'COMPLETED' && existingOrder.status !== 'COMPLETED';
    // washerAmount = totalPrice - commission (commission set at creation),
    // clamped to >= 0 (e.g. subscription orders at 0)
    const washerAmount = isCompletion
      ? Math.max(0, (existingOrder.totalPrice ?? 0) - (existingOrder.commission ?? 0))
      : 0;

    const order = await db.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
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

      // Credit the washer: totalEarnings + completedJobs (no WalletTransaction:
      // washer earnings are tracked via totalEarnings only)
      if (isCompletion && updatedOrder.washerId) {
        await tx.washer.update({
          where: { id: updatedOrder.washerId },
          data: {
            totalEarnings: { increment: washerAmount },
            completedJobs: { increment: 1 },
          },
        });
      }

      return updatedOrder;
    });

    // Create tracking event
    if (status) {
      await db.trackingEvent.create({
        data: {
          orderId,
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
