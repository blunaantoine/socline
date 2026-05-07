import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/jwt';

// POST /api/auth/mobile/refresh - Refresh access token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token requis' },
        { status: 400 }
      );
    }

    const result = await refreshAccessToken(refreshToken);

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du rafraîchissement' },
      { status: 500 }
    );
  }
}
