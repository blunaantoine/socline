import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  hashPin, verifyPin, generateToken, setAuthCookie,
  isLoginRateLimited, recordFailedLogin, clearLoginAttempts
} from '@/lib/auth';

// POST /api/auth/login - Login with phone + PIN
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

    // Find user
    const user = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      recordFailedLogin(cleanPhone);
      return NextResponse.json(
        { success: false, error: 'Numéro non enregistré' },
        { status: 400 }
      );
    }

    // Verify PIN with bcrypt (legacy plaintext PINs are auto-upgraded)
    if (!user.pin || !(await verifyPin(pin, user.pin, user.id))) {
      recordFailedLogin(cleanPhone);
      return NextResponse.json(
        { success: false, error: 'PIN incorrect' },
        { status: 400 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Compte désactivé. Contactez le support.' },
        { status: 400 }
      );
    }

    // Clear rate limiting on successful login
    clearLoginAttempts(cleanPhone);

    // Generate auth token with userId and set cookie
    const token = generateToken(user.id);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Connexion réussie!',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        plateNumber: user.plateNumber,
        carColor: user.carColor,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la connexion' },
      { status: 500 }
    );
  }
}
