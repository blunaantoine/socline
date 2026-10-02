import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/addresses - Get addresses of the session user
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
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
// Identity is derived from the session cookie (body userId is ignored).
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const { label, type, address, latitude, longitude, instructions, isDefault } = body;

    if (!label || !address) {
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
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création';
    return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
  }
}
