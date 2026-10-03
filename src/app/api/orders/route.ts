import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validatePromotionCode } from '@/lib/promo';
import { computePartnerLevel, commissionForLevel, DEFAULT_PARTNER_LEVEL } from '@/lib/washer-level';
import { emitRealtime } from '@/lib/realtime';
import { calculateDistanceKm } from '@/lib/geo';

// GET /api/orders - Get orders (for washer or client)
// Query params:
//   - userId: string - User ID (required for role-based queries)
//   - role: 'WASHER' | 'CLIENT'
//   - status: OrderStatus - Filter by order status
//   - stationId: string - Filter orders belonging to a specific station
//                         (orders where Order.stationId or Service.stationId matches)
export async function GET(request: NextRequest) {
  try {
    // Identity ALWAYS comes from the signed session cookie — the query
    // params can no longer be used to read someone else's orders.
    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }
    const session = auth.user;

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const stationId = searchParams.get('stationId');

    // Admins may query on behalf of any user (admin tooling);
    // everyone else is scoped to their own id.
    const userId = session.role === 'ADMIN' && requestedUserId ? requestedUserId : session.id;

    // Common include for all queries
    const baseInclude = {
      client: { select: { id: true, name: true, phone: true } },
      service: true,
      subscriptionUsage: {
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      },
    };

    let orders;

    // Station-scoped query: list all orders linked to a station (via Order.stationId
    // or via the service's stationId). Restricted to the station owner or an admin.
    if (stationId) {
      if (session.role !== 'ADMIN') {
        const station = await db.station.findUnique({ where: { id: stationId } });
        if (!station || station.ownerId !== session.id) {
          return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }
      }
      orders = await db.order.findMany({
        where: {
          OR: [
            { stationId },
            { service: { stationId } },
          ],
        },
        include: baseInclude,
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'WASHER') {
      // Resolve the Washer RECORD from the session user. Order.washerId
      // stores the Washer record id — querying with the User id used to
      // silently return an empty list.
      const washer = await db.washer.findFirst({
        where: { OR: [{ id: userId }, { userId }] },
      });
      if (!washer) {
        return NextResponse.json({ success: true, orders: [] });
      }
      // Pending orders are a shared job pool visible to any washer.
      // The pool is sorted by PROXIMITY to the washer (closest first);
      // orders without coordinates land at the end of the list.
      if (status === 'PENDING') {
        orders = await db.order.findMany({
          where: { status: 'PENDING' },
          include: baseInclude,
          orderBy: { createdAt: 'desc' },
        });

        if (washer.latitude != null && washer.longitude != null) {
          const withDistance = orders.map((o) => ({
            ...o,
            distanceKm: calculateDistanceKm(washer.latitude, washer.longitude, o.latitude, o.longitude),
          }));
          withDistance.sort((a, b) => {
            if (a.distanceKm == null && b.distanceKm == null) return 0;
            if (a.distanceKm == null) return 1;
            if (b.distanceKm == null) return -1;
            return a.distanceKm - b.distanceKm;
          });
          orders = withDistance.map((o) => ({
            ...o,
            distanceKm: o.distanceKm != null ? Math.round(o.distanceKm * 10) / 10 : null,
          }));
        }
      } else {
        orders = await db.order.findMany({
          where: { washerId: washer.id },
          include: baseInclude,
          orderBy: { createdAt: 'desc' },
        });
      }
    } else {
      // Client's own orders.
      orders = await db.order.findMany({
        where: { clientId: userId },
        include: {
          ...baseInclude,
          washer: { include: { user: { select: { name: true, phone: true } } } },
          payment: true,
          review: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Add subscription info to each order
    const ordersWithSubscription = orders.map(order => ({
      ...order,
      subscriptionInfo: order.isSubscriptionOrder ? {
        validated: order.subscriptionValidated,
        planName: order.subscriptionUsage?.subscription?.plan?.displayName || 'Abonnement',
        status: order.subscriptionUsage?.status || 'PENDING',
      } : null,
    }));

    return NextResponse.json({ success: true, orders: ordersWithSubscription });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/orders - Create new order
// SECURITY + PRICING:
//   - clientId always comes from the session cookie (body clientId ignored)
//   - totalPrice / discount / commission are ALWAYS recomputed server-side
//     from the service price and a server-validated promo code — values sent
//     by the client are never trusted.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }
    const clientId = auth.user.id;

    const body = await request.json();
    const {
      serviceId, isHomeService, address,
      latitude, longitude, scheduledAt,
      promoCode, useSubscription, stationId
    } = body;
    // NOTE: body clientId / totalPrice / discount are deliberately ignored.

    // Validate required fields
    if (!serviceId) {
      return NextResponse.json({ error: 'Service non sélectionné' }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: 'Adresse requise' }, { status: 400 });
    }

    // Verify client exists (from the session)
    const client = await db.user.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Utilisateur non trouvé. Veuillez vous reconnecter.' }, { status: 401 });
    }

    // Verify service exists
    const service = await db.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service non trouvé' }, { status: 400 });
    }

    // Check subscription if useSubscription is true
    let subscription = null;
    if (useSubscription) {
      subscription = await db.userSubscription.findFirst({
        where: {
          userId: clientId,
          isActive: true,
          isExpired: false,
          endDate: { gte: new Date() },
          remainingWashes: { gt: 0 },
        },
        include: {
          plan: { include: { service: true } },
        },
      });

      if (!subscription) {
        return NextResponse.json({ 
          error: 'Aucun abonnement actif trouvé. Veuillez souscrire à un abonnement ou payer normalement.' 
        }, { status: 400 });
      }

      // Verify service matches subscription's service
      if (subscription.plan.serviceId !== serviceId) {
        return NextResponse.json({ 
          error: `Cet abonnement est valable pour le service "${subscription.plan.service?.name || 'Non spécifié'}", pas pour "${service.name}".` 
        }, { status: 400 });
      }
    }

    // -----------------------------------------------------------------
    // SERVER-SIDE PRICING — the client never decides what it pays.
    // -----------------------------------------------------------------
    const basePrice = service.price;
    let discount = 0;
    let normalizedPromoCode: string | null = null;

    if (!useSubscription) {
      // Recompute the promo discount server-side (validity, usage limits,
      // per-user limit, min amount) — the client-sent discount is ignored.
      if (promoCode) {
        const promoResult = await validatePromotionCode(promoCode, clientId, basePrice);
        if (!promoResult.valid) {
          return NextResponse.json({ error: promoResult.error }, { status: 400 });
        }
        discount = promoResult.discountAmount;
        normalizedPromoCode = promoResult.promotion.code;
      }
    }

    // Final amount the client has to pay (subscription washes are free).
    const totalPrice = useSubscription ? 0 : Math.max(0, basePrice - discount);

    // Generate order number
    const orderNumber = `WG${Date.now().toString().slice(-8)}`;

    // Create order with subscription info if applicable
    const order = await db.order.create({
      data: {
        orderNumber,
        clientId,
        serviceId,
        isHomeService: isHomeService ?? true,
        stationId: stationId || null,
        address,
        latitude,
        longitude,
        basePrice,
        discount: useSubscription ? service.price : discount, // Full discount for subscription
        promoCode: useSubscription ? null : normalizedPromoCode,
        totalPrice,
        commission: useSubscription
          ? 0
          // Default commission at level 1 (Contrat de Partenariat, Article 5 :
          // part du Partenaire 60 %). Recalculated at ACCEPTED based on the
          // washer's actual level (see PATCH below).
          : commissionForLevel(DEFAULT_PARTNER_LEVEL, totalPrice),
        status: 'PENDING',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        isSubscriptionOrder: useSubscription || false,
        subscriptionId: subscription?.id || null,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: true,
        ...(stationId ? { station: true } : {}),
      },
    });

    // Create subscription usage record if using subscription
    if (useSubscription && subscription) {
      await db.subscriptionUsage.create({
        data: {
          subscriptionId: subscription.id,
          orderId: order.id,
          serviceName: service.name,
          washType: 'standard',
          address: address,
          status: 'PENDING',
        },
      });
    }

    // Increment promo code usage if applied (only for non-subscription orders)
    if (!useSubscription && normalizedPromoCode) {
      await db.promotion.updateMany({
        where: { code: normalizedPromoCode },
        data: { currentUses: { increment: 1 } },
      });
    }

    // -----------------------------------------------------------------
    // Alert the ONLINE washers about the new job (in-app notification
    // + best-effort realtime push to their rooms).
    // Only genuinely available washers are notified — availability is
    // persisted (PATCH /api/washers/[userId]).
    // -----------------------------------------------------------------
    try {
      const onlineWashers = await db.washer.findMany({
        where: {
          isAvailable: true,
          isVerified: true,
          user: { isActive: true, role: 'WASHER' },
        },
        select: { userId: true },
      });

      if (onlineWashers.length > 0) {
        const notifTitle = 'Nouvelle commande';
        const notifMessage = `${service.name} — ${address}`;
        const notifData = JSON.stringify({ orderId: order.id, orderNumber });
        await Promise.all(
          onlineWashers.map((w) =>
            db.notification.create({
              data: {
                userId: w.userId,
                title: notifTitle,
                message: notifMessage,
                type: 'NEW_ORDER',
                data: notifData,
              },
            }).catch(() => undefined)
          )
        );

        emitRealtime(
          onlineWashers.map((w) => `user:${w.userId}`),
          'order:new',
          order
        );
      }
    } catch (notifyError) {
      // Notifications are best-effort — the order must not fail because of them.
      console.error('New-order notification error:', notifyError);
    }

    return NextResponse.json({ 
      success: true, 
      order,
      isSubscriptionOrder: useSubscription,
      subscriptionInfo: subscription ? {
        planName: subscription.plan.displayName,
        remainingWashes: subscription.remainingWashes,
      } : null,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Order status state machine (shared rules with PATCH /api/orders/[id]).
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

// PATCH /api/orders - Update order status (accept, progress, cancel)
// SECURITY + STATE MACHINE:
//   - Identity always comes from the signed session cookie.
//   - WASHER: may ACCEPT a PENDING order (self-assignment) and move orders
//     already assigned to them forward; may cancel their own orders while
//     ACCEPTED/EN_ROUTE.
//   - CLIENT: may only CANCEL their own order, and only while PENDING/ACCEPTED.
//   - ADMIN: any (valid) transition on any order.
//   - Repeat PATCH with the SAME status is idempotent (no side effects).
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }
    const session = auth.user;

    const body = await request.json();
    const { orderId, status, washerId, cancelReason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }
    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
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
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
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
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }

      const isOwnOrder = existingOrder.washerId === washer.id;
      const isSelfAssign =
        status === 'ACCEPTED' && existingOrder.status === 'PENDING' && !existingOrder.washerId;
      const isOwnCancel =
        status === 'CANCELLED' && isOwnOrder && ['ACCEPTED', 'EN_ROUTE'].includes(existingOrder.status);

      // Availability is enforced SERVER-SIDE: an offline washer cannot grab
      // jobs from the pool (the toggle is persisted via PATCH /api/washers/[userId]).
      if (isSelfAssign && !washer.isAvailable) {
        return NextResponse.json(
          { error: 'Vous êtes hors ligne. Passez « En ligne » pour accepter des commandes.' },
          { status: 403 }
        );
      }

      if (isSelfAssign) {
        // The washer accepts a PENDING order → assign themselves.
        // Any body washerId is IGNORED (only admins may reassign).
        assignWasherId = washer.id;
      } else if (!isOwnOrder && !isOwnCancel) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }

      if (status === 'CANCELLED') {
        if (!isOwnCancel) {
          return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
        }
        resolvedCancelReason = 'Annulée par le laveur';
      }
    } else if (session.role === 'CLIENT') {
      const isOwnCancel =
        existingOrder.clientId === session.id &&
        status === 'CANCELLED' &&
        ['PENDING', 'ACCEPTED'].includes(existingOrder.status);

      if (!isOwnCancel) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
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
      return NextResponse.json({ error: 'Transition de statut invalide' }, { status: 400 });
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
        return NextResponse.json({ error: 'Laveur non trouvé' }, { status: 400 });
      }
      updateData.washerId = washerRecord.id;
    }

    // Contrat de Partenariat SOCLINE, Article 5 : when the order is accepted,
    // freeze the commission according to the accepting washer's progressive
    // level (60 % -> 80 % partner share). The rate applied at ACCEPTED is the
    // one kept for the whole order ("Le taux n'est jamais modifié pour les
    // prestations déjà réalisées").
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
    // washerAmount = totalPrice - commission (per Contrat Article 5, the
    // commission is frozen at ACCEPTED according to the washer's level),
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
          service: true,
          washer: { include: { user: { select: { name: true, phone: true } } } },
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

    // Create conversation if order is accepted
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

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
