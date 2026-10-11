import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { isPushConfigured } from '@/lib/firebase-admin';

// POST /api/notifications/register-token
// Registers (or clears) the current user's FCM push token. Identity comes
// from the session (cookie or Bearer) — the body never carries a userId.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: unknown;
    };
    const token =
      typeof body.token === 'string' ? body.token.trim() : '';

    // Empty / invalid token = explicit unregister.
    await db.user.update({
      where: { id: userId },
      data: { fcmToken: token.length >= 16 ? token : null },
    });

    return NextResponse.json({
      success: true,
      pushServerEnabled: isPushConfigured(),
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}
