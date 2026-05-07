import { NextRequest, NextResponse } from 'next/server';
import { requireAuthFromHeader } from '@/lib/jwt';

// GET /api/auth/mobile/me - Get current user from JWT token
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const result = await requireAuthFromHeader(authHeader);

    if (!result.authorized) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
