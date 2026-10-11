import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/stations - Liste de toutes les stations de lavage
// (gestion admin — les stations sont gérées séparément des laveurs indépendants)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const stations = await db.station.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
            washer: {
              select: { id: true, isVerified: true, isAvailable: true },
            },
          },
        },
        services: {
          where: { isActive: true },
          select: { id: true, name: true, price: true },
          orderBy: { price: 'asc' },
        },
        _count: {
          select: { washers: true, services: true, orders: true },
        },
      },
    });

    return NextResponse.json({ success: true, stations });
  } catch (error) {
    console.error('Admin stations GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des stations' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/stations - Actions admin sur une station
// body: { stationId, action: 'toggle-active' | 'verify-owner' | 'reject-owner' }
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { stationId, action } = await request.json();

    if (!stationId || !action) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants (stationId, action)' },
        { status: 400 }
      );
    }

    const station = await db.station.findUnique({
      where: { id: stationId },
      include: {
        owner: { include: { washer: true } },
      },
    });

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station introuvable' },
        { status: 404 }
      );
    }

    // Activer / désactiver la station (masquée côté client si inactive)
    if (action === 'toggle-active') {
      const updated = await db.station.update({
        where: { id: stationId },
        data: { isActive: !station.isActive },
      });
      return NextResponse.json({
        success: true,
        message: updated.isActive ? 'Station activée' : 'Station désactivée',
        station: updated,
      });
    }

    // Vérifier / rejeter le compte du propriétaire (validation admin)
    if (action === 'verify-owner' || action === 'reject-owner') {
      const washer = station.owner?.washer;
      if (!washer) {
        return NextResponse.json(
          { success: false, error: 'Aucun profil laveur trouvé pour le propriétaire de cette station' },
          { status: 404 }
        );
      }

      const verified = action === 'verify-owner';
      await db.washer.update({
        where: { id: washer.id },
        data: {
          isVerified: verified,
          // En cas de rejet, le laveur ne doit plus apparaître comme disponible
          ...(verified ? {} : { isAvailable: false }),
        },
      });

      return NextResponse.json({
        success: true,
        message: verified
          ? 'Propriétaire de station vérifié'
          : 'Propriétaire de station rejeté',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Action inconnue' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Admin stations PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la station' },
      { status: 500 }
    );
  }
}
