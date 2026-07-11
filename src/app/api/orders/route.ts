import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
        commission: useSubscription ? 0 : ((totalPrice ?? service.price) * 0.15),
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

    const order = await db.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: true,
        washer: { include: { user: { select: { name: true, phone: true } } } },
      },
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
