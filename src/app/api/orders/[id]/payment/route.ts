import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/orders/[id]/payment - Create payment record for an order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { userId, amount, method, phoneNumber } = body;

    if (!orderId || !userId || !amount) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Check if order exists
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

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

    // Create payment record
    const payment = await db.payment.create({
      data: {
        orderId,
        userId,
        amount,
        method: method || 'CASH',
        status: method === 'CASH' ? 'PENDING' : 'COMPLETED',
        phoneNumber,
        transactionId: method !== 'CASH' ? `TXN${Date.now()}` : null,
      },
    });

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

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
