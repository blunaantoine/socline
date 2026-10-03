import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { computePartnerLevel, PARTNER_LEVELS } from '@/lib/washer-level';

// GET /api/washers/[userId] - Get a single washer by user ID
// Returns the washer record (including washerType) and the related station (if STATION_OWNER)
// Access restricted to the washer itself or an ADMIN (403 otherwise).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID requis' },
        { status: 400 }
      );
    }

    // Self or admin only — no access to other users' washer profiles
    if (auth.user!.id !== userId && auth.user!.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
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

    // Contrat de Partenariat SOCLINE, Article 5 : compute the washer's
    // progressive partner level from the stats measured by the Application.
    const [completedJobs, cancelledJobs, assignedJobs] = await Promise.all([
      db.order.count({ where: { washerId: washer.id, status: 'COMPLETED' } }),
      db.order.count({ where: { washerId: washer.id, status: 'CANCELLED' } }),
      db.order.count({ where: { washerId: washer.id } }),
    ]);
    const cancellationRate = assignedJobs > 0 ? (cancelledJobs / assignedJobs) * 100 : 0;
    const partnerLevel = computePartnerLevel({
      completedJobs,
      rating: washer.rating,
      cancellationRate,
    });

    return NextResponse.json({
      success: true,
      washer,
      partnerLevel: {
        ...partnerLevel,
        stats: {
          completedJobs,
          rating: washer.rating,
          cancellationRate: Math.round(cancellationRate * 10) / 10,
        },
        nextLevel: PARTNER_LEVELS.find(l => l.level === partnerLevel.level + 1) || null,
      },
    });
  } catch (error) {
    console.error('Get washer by userId error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement du profil de laveur' },
      { status: 500 }
    );
  }
}

// PATCH /api/washers/[userId] - Update the washer's availability.
// The "En ligne / Hors ligne" toggle is now PERSISTED in the database so:
//   - clients only see genuinely available washers,
//   - the order API can refuse acceptations from offline washers.
// Body: { isAvailable: boolean }
// Access: the washer itself or an ADMIN.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID requis' },
        { status: 400 }
      );
    }

    // Self or admin only
    if (auth.user!.id !== userId && auth.user!.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { isAvailable, latitude, longitude } = body;

    if (typeof isAvailable !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isAvailable (booléen) requis' },
        { status: 400 }
      );
    }

    const washer = await db.washer.findUnique({ where: { userId } });
    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Profil de laveur introuvable' },
        { status: 404 }
      );
    }

    // Optional GPS position update (sent when the washer goes online) so the
    // pending-job pool can be sorted by proximity.
    const data: { isAvailable: boolean; latitude?: number; longitude?: number } = {
      isAvailable,
    };
    if (
      typeof latitude === 'number' && isFinite(latitude) &&
      typeof longitude === 'number' && isFinite(longitude)
    ) {
      data.latitude = latitude;
      data.longitude = longitude;
    }

    const updated = await db.washer.update({
      where: { userId },
      data,
      select: { id: true, userId: true, isAvailable: true, latitude: true, longitude: true },
    });

    return NextResponse.json({ success: true, washer: updated });
  } catch (error) {
    console.error('Update washer availability error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la disponibilité' },
      { status: 500 }
    );
  }
}
