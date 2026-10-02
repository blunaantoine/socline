import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computePartnerLevel, commissionForLevel, DEFAULT_PARTNER_LEVEL } from '@/lib/washer-level';

// GET /api/orders - Get orders (for washer or client)
// Query params:
//   - userId: string - User ID (required for role-based queries)
//   - role: 'WASHER' | 'CLIENT'
//   - status: OrderStatus - Filter by order status
//   - stationId: string - Filter orders belonging to a specific station
//                         (orders where Order.stationId or Service.stationId matches)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const stationId = searchParams.get('stationId');

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
    // or via the service's stationId). This is used by STATION_OWNERs.
    if (stationId) {
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
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }
      // Get orders assigned to washer or pending orders
      if (status === 'PENDING') {
        orders = await db.order.findMany({
          where: { status: 'PENDING' },
          include: baseInclude,
          orderBy: { createdAt: 'desc' },
        });
      } else {
        orders = await db.order.findMany({
          where: { washerId: userId },
          include: baseInclude,
          orderBy: { createdAt: 'desc' },
        });
      }
    } else {
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }
      // Get client's orders
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      clientId, serviceId, isHomeService, address, 
      latitude, longitude, totalPrice, scheduledAt,
      promoCode, discount, useSubscription, stationId
    } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json({ error: 'Utilisateur non connecté' }, { status: 401 });
    }
    if (!serviceId) {
      return NextResponse.json({ error: 'Service non sélectionné' }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: 'Adresse requise' }, { status: 400 });
    }

    // Verify client exists
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
        basePrice: service.price,
        discount: useSubscription ? service.price : (discount ?? 0), // Full discount for subscription
        promoCode: useSubscription ? null : (promoCode ?? null),
        totalPrice: useSubscription ? 0 : (totalPrice ?? service.price), // Free for subscription
        commission: useSubscription
          ? 0
          // Default commission at level 1 (Contrat de Partenariat, Article 5 :
          // part du Partenaire 60 %). Recalculated at ACCEPTED based on the
          // washer's actual level (see PATCH below).
          : commissionForLevel(DEFAULT_PARTNER_LEVEL, totalPrice ?? service.price),
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
    if (!useSubscription && promoCode) {
      await db.promotion.updateMany({
        where: { code: promoCode },
        data: { currentUses: { increment: 1 } },
      });
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

// PATCH /api/orders - Update order (accept, update status)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, washerId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const updateData: any = { status };
    
    // If washerId is provided, find the actual Washer record
    if (washerId) {
      // Check if it's a userId or a washerId
      const washer = await db.washer.findFirst({
        where: { 
          OR: [
            { id: washerId },
            { userId: washerId }
          ]
        }
      });
      
      if (!washer) {
        return NextResponse.json({ error: 'Laveur non trouvé' }, { status: 400 });
      }
      
      updateData.washerId = washer.id;
    }

    // Fetch the current order state (previous status + pricing)
    // needed for the COMPLETED washer credit logic
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, totalPrice: true, commission: true, washerId: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
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

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
