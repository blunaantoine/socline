import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import type { Session } from '@/lib/auth';

// Resolves the Washer record for a session user (a conversation stores the
// Washer record id in washerId, not the User id).
async function getWasherForSession(userId: string) {
  return db.washer.findUnique({ where: { userId } });
}

// Checks that the session user participates in a conversation:
// either as the client, or as the assigned washer (Washer record id).
async function isConversationParticipant(conversation: { clientId: string; washerId: string | null }, userId: string) {
  if (conversation.clientId === userId) return true;
  if (conversation.washerId) {
    const washer = await getWasherForSession(userId);
    if (washer && washer.id === conversation.washerId) return true;
  }
  return false;
}

// Checks that the session user is involved in an order:
// either the client, or the assigned washer (Washer record id).
async function isOrderParticipant(order: { clientId: string; washerId: string | null }, userId: string) {
  if (order.clientId === userId) return true;
  if (order.washerId) {
    const washer = await getWasherForSession(userId);
    if (washer && washer.id === order.washerId) return true;
  }
  return false;
}

const conversationInclude = {
  order: {
    include: {
      service: true,
      client: {
        select: { id: true, name: true, phone: true, plateNumber: true, carColor: true },
      },
      washer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  },
} as const;

// GET /api/conversations - Get session user's conversations or by orderId
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const session: Session = auth.user!;
  const userId = session.id;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    // If orderId is provided, get conversation by order
    if (orderId) {
      const conversation = await db.conversation.findFirst({
        where: { orderId },
        include: {
          order: conversationInclude.order,
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (!conversation) {
        // Create conversation if it doesn't exist (for accepted orders) —
        // but only for a participant of the order
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: {
            client: { select: { id: true, name: true, phone: true, plateNumber: true, carColor: true } },
            washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
            service: true,
          },
        });

        if (order && order.washerId && (await isOrderParticipant(order, userId))) {
          const newConversation = await db.conversation.create({
            data: {
              orderId,
              clientId: order.clientId,
              washerId: order.washerId,
              isActive: true,
            },
            include: {
              order: conversationInclude.order,
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 50,
              },
            },
          });

          return NextResponse.json({
            success: true,
            conversation: newConversation,
          });
        }

        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 }
        );
      }

      // Only a participant may read the conversation
      if (!(await isConversationParticipant(conversation, userId))) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        conversation,
      });
    }

    // List conversations where the session user is a participant:
    // client side (User id) or washer side (Washer record id)
    const washer = await getWasherForSession(userId);

    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          { clientId: userId },
          ...(washer ? [{ washerId: washer.id }] : []),
        ],
      },
      include: {
        order: conversationInclude.order,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create or get conversation for an order
// Identity is derived from the session cookie: only a participant of the
// order (client or assigned washer) may create/read the conversation, and
// clientId/washerId always come from the order (body values are ignored).
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID required' },
        { status: 400 }
      );
    }

    // Check if conversation already exists
    let conversation = await db.conversation.findUnique({
      where: { orderId },
      include: {
        order: conversationInclude.order,
      },
    });

    if (conversation) {
      if (!(await isConversationParticipant(conversation, userId))) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        conversation,
      });
    }

    // Create new conversation: the order must exist and the session user
    // must be a participant (client or assigned washer)
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true, phone: true, plateNumber: true, carColor: true } },
        washer: { include: { user: { select: { id: true, name: true, phone: true } } } },
        service: true,
      },
    });

    if (!order || !(await isOrderParticipant(order, userId))) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    conversation = await db.conversation.create({
      data: {
        orderId,
        clientId: order.clientId,
        washerId: order.washerId,
        isActive: true,
      },
      include: {
        order: conversationInclude.order,
      },
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
