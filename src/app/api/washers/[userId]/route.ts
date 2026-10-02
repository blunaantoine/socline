import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computePartnerLevel, PARTNER_LEVELS } from '@/lib/washer-level';

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
