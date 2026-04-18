import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/notifications - Get notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // If no notifications exist, create some sample ones for demo
    if (notifications.length === 0) {
      const sampleNotifications = [
        {
          userId,
          title: 'Bienvenue sur WashGo! 🎉',
          message: 'Merci de rejoindre WashGo. Votre première commande vous attend!',
          type: 'system',
          isRead: false,
        },
        {
          userId,
          title: 'Offre spéciale',
          message: '-20% sur votre premier lavage auto. Offre valable jusqu\'à la fin du mois!',
          type: 'promo',
          isRead: false,
        },
      ];

      await db.notification.createMany({
        data: sampleNotifications,
      });

      const newNotifications = await db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({
        success: true,
        notifications: newNotifications.map((n) => ({
          id: n.id,
          type: n.type as 'order' | 'message' | 'payment' | 'promo' | 'system',
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    }

    return NextResponse.json({
      success: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type as 'order' | 'message' | 'payment' | 'promo' | 'system',
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get notifications' },
      { status: 500 }
    );
  }
}
