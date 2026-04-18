import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/orders - Get orders (for washer or client)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    let orders;

    if (role === 'WASHER') {
      // Get orders assigned to washer or pending orders
      if (status === 'PENDING') {
        orders = await db.order.findMany({
          where: { status: 'PENDING' },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            service: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        orders = await db.order.findMany({
          where: { washerId: userId },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            service: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    } else {
      // Get client's orders
      orders = await db.order.findMany({
        where: { clientId: userId },
        include: {
          service: true,
          washer: { include: { user: { select: { name: true, phone: true } } } },
          payment: true,
          review: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ success: true, orders });
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
      latitude, longitude, totalPrice, scheduledAt 
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

    // Generate order number
    const orderNumber = `WG${Date.now().toString().slice(-8)}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        clientId,
        serviceId,
        isHomeService: isHomeService ?? true,
        address,
        latitude,
        longitude,
        basePrice: totalPrice ?? service.price,
        totalPrice: totalPrice ?? service.price,
        commission: (totalPrice ?? service.price) * 0.15,
        status: 'PENDING',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: true,
      },
    });

    return NextResponse.json({ success: true, order });
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
