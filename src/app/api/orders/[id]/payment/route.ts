import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';

// POST /api/orders/[id]/payment - Create payment record for an order
// Identity and amount are derived server-side: userId from the session,
// amount from the order. Client-supplied userId/amount are ignored.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { method, phoneNumber } = body;

    // Check if order exists
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Only the order's client may register its payment
    if (order.clientId !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // The amount always comes from the order (client value ignored)
    const amount = order.totalPrice;

    // Check if payment already exists
    const existingPayment = await db.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        payment: existingPayment,
        message: 'Paiement déjà enregistré'
      });
    }

    // Validate method: only CASH or WALLET are allowed (default CASH as today)
    const validMethod = method === 'WALLET' ? 'WALLET' : 'CASH';

    // Create payment record
    const payment = await db.payment.create({
      data: {
        orderId,
        userId,
        amount,
        method: validMethod,
        status: validMethod === 'CASH' ? 'PENDING' : 'COMPLETED',
        phoneNumber,
        transactionId: validMethod !== 'CASH' ? `TXN${Date.now()}` : null,
      },
    });

    // The washer MUST know how he gets paid:
    //   CASH   → he has to collect the money from the client on site.
    //   WALLET → already settled, nothing to collect.
    if (order.washerId) {
      const washerRecord = await db.washer.findUnique({
        where: { id: order.washerId },
        select: { userId: true },
      });
      if (washerRecord?.userId) {
        const amountLabel = `${amount.toLocaleString('fr-FR')} XOF`;
        await notify({
          userId: washerRecord.userId,
          title: validMethod === 'CASH' ? 'Paiement en espèces 💵' : 'Paiement par portefeuille ✅',
          message: validMethod === 'CASH'
            ? `Commande ${order.orderNumber} — encaissez ${amountLabel} en espèces auprès du client.`
            : `Commande ${order.orderNumber} — ${amountLabel} déjà réglés via le portefeuille. Rien à encaisser.`,
          type: 'payment',
          data: { orderId: order.id, orderNumber: order.orderNumber, method: validMethod, amount },
        });
      }
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création du paiement' }, { status: 500 });
  }
}

// GET /api/orders/[id]/payment - Get payment for an order
// Access restricted to the order's client, the assigned washer
// (via the Washer record) or an ADMIN.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id: orderId } = await params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, washerId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Access check: order client, assigned washer (Washer record id) or ADMIN
    let isWasherParticipant = false;
    if (order.washerId) {
      const washer = await db.washer.findUnique({
        where: { userId },
        select: { id: true },
      });
      isWasherParticipant = !!washer && washer.id === order.washerId;
    }

    if (order.clientId !== userId && !isWasherParticipant && auth.user!.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const payment = await db.payment.findUnique({
      where: { orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Get payment error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
