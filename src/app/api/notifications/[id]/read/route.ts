import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/notifications/[id]/read - Mark a notification as read
// Identity is derived from the session cookie: the notification must
// belong to the session user, otherwise 404.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { id: notificationId } = await params;

    const notification = await db.notification.findFirst({
      where: { id: notificationId, userId: auth.user!.id },
      select: { id: true },
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification non trouvée' },
        { status: 404 }
      );
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
