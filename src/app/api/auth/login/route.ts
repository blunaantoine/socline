import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

// Generate random token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

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

    // Find user
    const user = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Numéro non enregistré' },
        { status: 400 }
      );
    }

    // Verify PIN (in production, compare hashed values)
    if (user.pin !== pin) {
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

    // Generate auth token
    const token = generateToken();

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
