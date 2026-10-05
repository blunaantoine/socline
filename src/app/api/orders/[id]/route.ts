import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { computePartnerLevel, commissionForLevel } from '@/lib/washer-level';
import { emitRealtime } from '@/lib/realtime';
import { notifyOrderStatusChange } from '@/lib/order-notifications';

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

// ---------------------------------------------------------------------------
// Order status state machine (same rules as PATCH /api/orders).
// ---------------------------------------------------------------------------
const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

const VALID_ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS);

// PATCH /api/orders/[id] - Update order status
// Same hardening as PATCH /api/orders (auth + state machine + role rules):
//   - WASHER: may ACCEPT a PENDING order (self-assignment, body washerId
//     ignored) and move orders assigned to them forward; may cancel their own
//     orders while ACCEPTED/EN_ROUTE.
//   - CLIENT: may only CANCEL their own order while PENDING/ACCEPTED.
//   - ADMIN: any (valid) transition on any order.
//   - Same-status repeat PATCH is idempotent (no side effects).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }
    const session = auth.user;

    const body = await request.json();
    const { status, washerId, cancelReason } = body;

    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Statut invalide' },
        { status: 400 }
      );
    }

    // Load the order with the relations needed for authorization, the
    // business logic and the realtime payload.
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
        service: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // -----------------------------------------------------------------
    // Authorization per role
    // -----------------------------------------------------------------
    let assignWasherId: string | null = null; // set when a washer accepts a PENDING order
    let resolvedCancelReason: string | null = null;

    if (session.role === 'WASHER') {
      // Order.washerId stores the Washer RECORD id — resolve the session user
      // to their washer record (id or userId are both accepted).
      const washer = await db.washer.findFirst({
        where: { OR: [{ id: session.id }, { userId: session.id }] },
      });
      if (!washer) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé' },
          { status: 403 }
        );
      }

      const isOwnOrder = existingOrder.washerId === washer.id;
      const isSelfAssign =
        status === 'ACCEPTED' && existingOrder.status === 'PENDING' && !existingOrder.washerId;
      const isOwnCancel =
        status === 'CANCELLED' && isOwnOrder && ['ACCEPTED', 'EN_ROUTE'].includes(existingOrder.status);

      if (isSelfAssign) {
        // Accepting a PENDING order assigns the accepting washer — a raw
        // body washerId is never trusted (only admins may reassign).
        assignWasherId = washer.id;
      } else if (!isOwnOrder && !isOwnCancel) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé' },
          { status: 403 }
        );
      }

      if (status === 'CANCELLED') {
        if (!isOwnCancel) {
          return NextResponse.json(
            { success: false, error: 'Accès non autorisé' },
            { status: 403 }
          );
        }
        resolvedCancelReason = 'Annulée par le laveur';
      }
    } else if (session.role === 'CLIENT') {
      const isOwnCancel =
        existingOrder.clientId === session.id &&
        status === 'CANCELLED' &&
        ['PENDING', 'ACCEPTED'].includes(existingOrder.status);

      if (!isOwnCancel) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé' },
          { status: 403 }
        );
      }
      resolvedCancelReason = cancelReason || 'Annulée par le client';
    }
    // ADMIN: any valid transition on any order (admin tooling).

    // -----------------------------------------------------------------
    // Idempotent repeat: same status → success with the unchanged order,
    // without re-running any side effect (credit, timestamps, emit).
    // -----------------------------------------------------------------
    if (existingOrder.status === status) {
      return NextResponse.json({ success: true, order: existingOrder });
    }

    // -----------------------------------------------------------------
    // State machine
    // -----------------------------------------------------------------
    if (!ORDER_TRANSITIONS[existingOrder.status]?.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Transition de statut invalide' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------
    // Build the update payload (timestamps per new status)
    // -----------------------------------------------------------------
    const updateData: any = { status };

    if (status === 'ACCEPTED') updateData.acceptedAt = new Date();
    if (status === 'EN_ROUTE') updateData.startedAt = new Date();
    if (status === 'ARRIVED') updateData.arrivedAt = new Date();
    // IN_PROGRESS: no dedicated wash-start field — arrivedAt is kept as-is.
    if (status === 'COMPLETED') updateData.completedAt = new Date();
    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      const reason = resolvedCancelReason || (typeof cancelReason === 'string' ? cancelReason : null);
      if (reason) updateData.cancelReason = reason;
    }
    if (assignWasherId) {
      updateData.washerId = assignWasherId;
    } else if (session.role === 'ADMIN' && washerId) {
      // Admin may (re)assign a washer — resolve User id vs Washer record id.
      const washerRecord = await db.washer.findFirst({
        where: { OR: [{ id: washerId }, { userId: washerId }] },
      });
      if (!washerRecord) {
        return NextResponse.json(
          { success: false, error: 'Laveur non trouvé' },
          { status: 400 }
        );
      }
      updateData.washerId = washerRecord.id;
    }

    // Contrat de Partenariat SOCLINE, Article 5: freeze the commission
    // according to the accepting washer's progressive level at ACCEPTED.
    if (updateData.washerId && existingOrder.status === 'PENDING' && status === 'ACCEPTED') {
      const washerRecordId = updateData.washerId as string;
      const [completedJobs, cancelledJobs, assignedJobs, washerRecord] = await Promise.all([
        db.order.count({ where: { washerId: washerRecordId, status: 'COMPLETED' } }),
        db.order.count({ where: { washerId: washerRecordId, status: 'CANCELLED' } }),
        db.order.count({ where: { washerId: washerRecordId } }),
        db.washer.findUnique({ where: { id: washerRecordId }, select: { rating: true } }),
      ]);
      const cancellationRate = assignedJobs > 0 ? (cancelledJobs / assignedJobs) * 100 : 0;
      const partnerLevel = computePartnerLevel({
        completedJobs,
        rating: washerRecord?.rating ?? 0,
        cancellationRate,
      });
      updateData.commission = commissionForLevel(partnerLevel, existingOrder.totalPrice ?? 0);
    }

    // Credit the washer when the order transitions to COMPLETED
    // (only if its previous status was not already COMPLETED — anti double-credit)
    const isCompletion = status === 'COMPLETED' && existingOrder.status !== 'COMPLETED';
    // washerAmount = totalPrice - commission (commission frozen at ACCEPTED),
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

    // Create tracking event (kept from the original route behavior)
    await db.trackingEvent.create({
      data: {
        orderId,
        event: status,
        message: `Order status changed to ${status}`,
      },
    });

    // Create conversation if order is accepted (parity with PATCH /api/orders)
    if (status === 'ACCEPTED' && order.washerId && order.clientId) {
      const existingConversation = await db.conversation.findFirst({
        where: { orderId: order.id },
      });

      if (!existingConversation) {
        await db.conversation.create({
          data: {
            orderId: order.id,
            clientId: order.clientId,
            washerId: order.washerId,
            isActive: true,
          },
        });
      }
    }

    // Best-effort realtime push (client tracking screen + washer app).
    emitRealtime(
      [
        'order:' + order.id,
        'user:' + order.clientId,
        ...(order.washer?.userId ? ['user:' + order.washer.userId] : []),
      ],
      'order:updated',
      order
    );

    // Persistent step notification for the client (and the washer when the
    // client cancels or the washer gets credited) — best-effort, never blocks.
    await notifyOrderStatusChange(order, {
      actorRole: session.role as 'WASHER' | 'CLIENT' | 'ADMIN',
      ...(isCompletion ? { washerAmount } : {}),
    });

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
