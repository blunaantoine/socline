import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/auth/me - Check if current user session is valid
// The user identity is derived from the signed session cookie, never from query params.
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ valid: false, error: 'No valid session' });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        plateNumber: true,
        carColor: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({ valid: false, error: 'User not found' });
    }

    if (!user.isActive) {
      return NextResponse.json({ valid: false, error: 'Account disabled' });
    }

    return NextResponse.json({ valid: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ valid: false, error: 'Server error' });
  }
}
