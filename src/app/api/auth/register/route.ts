import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

// Generate random token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// POST /api/auth/register - Register new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, plateNumber, carColor, pin } = body;

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

    // Validate PIN (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'Le PIN doit contenir exactement 4 chiffres' },
        { status: 400 }
      );
    }

    // Validate phone format (Togo: 8 digits starting with 9)
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^9\d{7}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone invalide (8 chiffres commençant par 9)' },
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

    // Create user with all fields
    const user = await db.user.create({
      data: {
        phone: cleanPhone,
        name,
        plateNumber: plateNumber?.toUpperCase() || 'NON DEFINI',
        carColor: carColor || 'Non défini',
        pin, // In production, hash this!
        role: 'CLIENT',
      },
    });

    // Generate auth token
    const token = generateToken();

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
