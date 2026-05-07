import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithJWT } from '@/lib/jwt';
import { isLoginRateLimited, recordFailedLogin, clearLoginAttempts } from '@/lib/auth';

// POST /api/auth/mobile/login - Login with phone + PIN (returns JWT for mobile)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, pin } = body;

    // Validate required fields
    if (!phone || !pin) {
      return NextResponse.json(
        { success: false, error: 'Téléphone et PIN requis' },
        { status: 400 }
      );
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN invalide' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\s/g, '');

    // Check rate limiting
    const rateLimit = isLoginRateLimited(cleanPhone);
    if (rateLimit.limited) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Trop de tentatives. Réessayez dans ${rateLimit.remainingTime} minute(s).` 
        },
        { status: 429 }
      );
    }

    // Authenticate with JWT
    const result = await authenticateWithJWT(cleanPhone, pin);

    if (!result.success) {
      recordFailedLogin(cleanPhone);
      return NextResponse.json(result, { status: 400 });
    }

    // Clear rate limiting on successful login
    clearLoginAttempts(cleanPhone);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la connexion' },
      { status: 500 }
    );
  }
}
