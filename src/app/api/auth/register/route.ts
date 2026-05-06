import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPin, generateToken, setAuthCookie } from '@/lib/auth';

// POST /api/auth/register - Register new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, plateNumber, carColor, pin, otp } = body;

    // Validate required fields
    if (!name || !phone || !pin) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Nom, téléphone et PIN sont requis' 
        },
        { status: 400 }
      );
    }

    // Validate OTP (must be 6 digits, test code is 123456)
    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Code OTP invalide' },
        { status: 400 }
      );
    }

    // For testing: accept 123456 as valid OTP
    // In production, verify against stored OTP
    if (otp !== '123456') {
      return NextResponse.json(
        { success: false, error: 'Code OTP incorrect' },
        { status: 400 }
      );
    }

    // Validate PIN (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'Le PIN doit contenir exactement 4 chiffres' },
        { status: 400 }
      );
    }

    // Validate phone format (Togo: 8 digits starting with 7 or 9)
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^[79]\d{7}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone inval (8 chiffres commençant par 7 ou 9)' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ce numéro est déjà enregistré' },
        { status: 400 }
      );
    }

    // Hash the PIN before storing
    const hashedPin = await hashPin(pin);

    // Create user with hashed PIN
    const user = await db.user.create({
      data: {
        phone: cleanPhone,
        name,
        plateNumber: plateNumber?.toUpperCase() || 'NON DEFINI',
        carColor: carColor || 'Non défini',
        pin: hashedPin,
        role: 'CLIENT',
      },
    });

    // Generate auth token and set cookie
    const token = generateToken(user.id);
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Inscription réussie!',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        plateNumber: user.plateNumber,
        carColor: user.carColor,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    );
  }
}
