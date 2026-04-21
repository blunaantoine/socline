import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/addresses - Get user addresses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const addresses = await db.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ success: true, addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/addresses - Create new address
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, label, type, address, latitude, longitude, instructions, isDefault } = body;

    if (!userId || !label || !address) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    // If this is default, remove default from other addresses
    if (isDefault) {
      await db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const newAddress = await db.address.create({
      data: {
        userId,
        label,
        type: type || 'OTHER',
        address,
        latitude,
        longitude,
        instructions,
        isDefault: isDefault || false
      }
    });

    return NextResponse.json({ success: true, address: newAddress });
  } catch (error) {
    console.error('Create address error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}
