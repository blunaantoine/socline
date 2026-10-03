import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/notifications - Get notifications for the session user
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    // REAL notifications only — the old demo block that injected fake
    // "Bienvenue sur Socline! 🎉" / "-20%" messages for every new user has
    // been removed. Notifications are now created exclusively by the
    // centralized notify() service (real events: orders, payments,
    // withdrawals...).
    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

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
