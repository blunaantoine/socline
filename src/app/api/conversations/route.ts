import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          { clientId: userId },
          { washerId: userId },
        ],
      },
      include: {
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, clientId, washerId } = body;

    if (!orderId || !clientId) {
      return NextResponse.json(
        { success: false, error: 'Order ID and Client ID required' },
        { status: 400 }
      );
    }

    // Check if conversation already exists
    let conversation = await db.conversation.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            service: true,
            client: { select: { id: true, name: true, phone: true } },
            washer: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await db.conversation.create({
        data: {
          orderId,
          clientId,
          washerId,
          isActive: true,
        },
        include: {
          order: {
            include: {
              service: true,
              client: { select: { id: true, name: true, phone: true } },
              washer: {
                include: {
                  user: { select: { id: true, name: true, phone: true } },
                },
              },
            },
          },
        },
      });
    }

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
