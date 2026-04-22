import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/auth/me - Check if current user session is valid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ valid: false, error: 'No user ID provided' });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
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
