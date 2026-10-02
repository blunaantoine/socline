import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Resolves the session user's participation in a conversation:
// client side (User id) or washer side (Washer record id → conversation.washerId).
// Returns true if the session user is a participant.
async function isParticipant(
  conversation: { clientId: string; washerId: string | null },
  userId: string
): Promise<boolean> {
  if (conversation.clientId === userId) return true;
  if (conversation.washerId) {
    const washer = await db.washer.findUnique({ where: { userId } });
    if (washer && washer.id === conversation.washerId) return true;
  }
  return false;
}

// Resolves the other participant's User id (the message receiver):
// - if the session user is the conversation client → the washer's User id
// - otherwise (session user is the washer) → the client's User id
async function resolveReceiverId(
  conversation: { clientId: string; washerId: string | null },
  userId: string
): Promise<string | null> {
  if (conversation.clientId === userId) {
    if (!conversation.washerId) return null;
    const washer = await db.washer.findUnique({
      where: { id: conversation.washerId },
      select: { userId: true },
    });
    return washer?.userId ?? null;
  }
  return conversation.clientId;
}

// GET /api/conversations/[id]/messages - Get messages for a conversation
// Identity is derived from the session cookie: only a participant
// (client or assigned washer) may read the messages.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Message ID for pagination

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (!(await isParticipant(conversation, userId))) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    const messages = await db.message.findMany({
      where: {
        conversationId,
        ...(before ? { id: { lt: before } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[id]/messages - Send a message
// Identity is derived from the session cookie: senderId is always the
// session user and receiverId is the other participant of the
// conversation (body senderId/receiverId are ignored).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id: conversationId } = await params;
    const body = await request.json();
    const { type, content, imageUrl, latitude, longitude, quickType } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if conversation is active
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (!(await isParticipant(conversation, userId))) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    if (conversation.isLocked) {
      return NextResponse.json(
        { success: false, error: 'Cette conversation est verrouillée' },
        { status: 400 }
      );
    }

    // sender = session user, receiver = the other participant
    const receiverId = await resolveReceiverId(conversation, userId);

    if (!receiverId) {
      return NextResponse.json(
        { success: false, error: 'Aucun destinataire pour cette conversation' },
        { status: 400 }
      );
    }

    // Create message
    const message = await db.message.create({
      data: {
        conversationId,
        senderId: userId,
        receiverId,
        type: type || 'TEXT',
        content,
        imageUrl,
        latitude,
        longitude,
        quickType,
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });

    // Update conversation last message
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.slice(0, 100),
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
