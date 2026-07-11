import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/washers/[userId] - Get a single washer by user ID
// Returns the washer record (including washerType) and the related station (if STATION_OWNER)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID requis' },
        { status: 400 }
      );
    }

    const washer = await db.washer.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, phone: true, avatar: true } },
        station: true,
      },
    });

    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Profil de laveur introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      washer,
    });
  } catch (error) {
    console.error('Get washer by userId error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement du profil de laveur' },
      { status: 500 }
    );
  }
}
