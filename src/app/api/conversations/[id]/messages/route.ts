import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Message ID for pagination

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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = await request.json();
    const { senderId, receiverId, type, content, imageUrl, latitude, longitude, quickType } = body;

    if (!senderId || !receiverId || !content) {
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

    if (conversation.isLocked) {
      return NextResponse.json(
        { success: false, error: 'Cette conversation est verrouillée' },
        { status: 400 }
      );
    }

    // Create message
    const message = await db.message.create({
      data: {
        conversationId,
        senderId,
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
