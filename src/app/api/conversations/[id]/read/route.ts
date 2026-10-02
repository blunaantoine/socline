import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/conversations/[id]/read - Mark messages as read
// Identity is derived from the session cookie (body userId is ignored):
// only a participant (client or assigned washer) may mark their own
// messages as read.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id: conversationId } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Participant check: client (User id) or washer (Washer record id)
    let isParticipant = conversation.clientId === userId;
    if (!isParticipant && conversation.washerId) {
      const washer = await db.washer.findUnique({ where: { userId } });
      isParticipant = !!washer && washer.id === conversation.washerId;
    }

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Mark all unread messages in this conversation where the session user is the receiver
    const result = await db.message.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}
