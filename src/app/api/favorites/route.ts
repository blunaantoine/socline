import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/favorites - List the session client's favorite washers
// (with the washer's public stats so the client recognizes them).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized || !auth.user) {
    return auth.response!;
  }

  try {
    const favorites = await db.favorite.findMany({
      where: { clientId: auth.user.id },
      include: {
        washer: {
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      favorites: favorites.map((f) => ({
        id: f.id,
        washerId: f.washerId,
        createdAt: f.createdAt.toISOString(),
        washer: {
          id: f.washer.id,
          name: f.washer.user?.name || 'Laveur',
          phone: f.washer.user?.phone || null,
          rating: f.washer.rating,
          totalRatings: f.washer.totalRatings,
          completedJobs: f.washer.completedJobs,
        },
      })),
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/favorites?washerId=... - Remove a washer from favorites.
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized || !auth.user) {
    return auth.response!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const washerId = searchParams.get('washerId');
    if (!washerId) {
      return NextResponse.json({ error: 'washerId requis' }, { status: 400 });
    }

    await db.favorite.deleteMany({
      where: { clientId: auth.user.id, washerId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete favorite error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
