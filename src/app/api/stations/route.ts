import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/stations - Get all active stations with their services and owner info
// Query params:
//   - ownerId: string - Filter stations by owner (User ID of the station owner)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseFloat(searchParams.get('radius') || '50'); // km
    const ownerId = searchParams.get('ownerId');

    // Build the where clause. When filtering by owner, return stations regardless
    // of isActive so the owner can see/edit their station even if deactivated.
    const where: any = ownerId ? { ownerId } : { isActive: true };

    let stations = await db.station.findMany({
      where,
      include: {
        washers: {
          where: { isAvailable: true },
          select: { id: true },
        },
        services: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        owner: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // Calculate distances and filter by radius (skip when filtering by owner)
    if (!ownerId && latitude && longitude) {
      stations = stations
        .map((station) => ({
          ...station,
          distance: calculateDistance(
            latitude,
            longitude,
            station.latitude || 0,
            station.longitude || 0
          ),
          availableWashers: station.washers.length,
        }))
        .filter((station) => station.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    }

    return NextResponse.json({
      success: true,
      stations,
    });
  } catch (error) {
    console.error('Get stations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stations' },
      { status: 500 }
    );
  }
}

// POST /api/stations - Create a new service for the authenticated STATION_OWNER's station
// Independent washers CANNOT create services - they use APP services
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const auth = await requireAuth(request);
    if (!auth.authorized || !auth.user) {
      return auth.response!;
    }

    const user = auth.user;

    // Fetch the washer record for the authenticated user
    const washer = await db.washer.findUnique({
      where: { userId: user.id },
    });

    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Aucun profil de laveur trouvé pour cet utilisateur' },
        { status: 404 }
      );
    }

    // Only STATION_OWNER washers can create services
    if (washer.washerType !== 'STATION_OWNER') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires de station peuvent créer des services' },
        { status: 403 }
      );
    }

    // STATION_OWNER must be linked to a station
    if (!washer.stationId) {
      return NextResponse.json(
        { success: false, error: 'Aucune station associée à ce propriétaire' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, price, duration, category, image } = body;

    // Validate required fields
    if (!name || price === undefined || price === null || !duration) {
      return NextResponse.json(
        { success: false, error: 'Nom, prix et durée sont requis' },
        { status: 400 }
      );
    }

    const numericPrice = parseFloat(price);
    const numericDuration = parseInt(duration);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'Prix invalide' },
        { status: 400 }
      );
    }

    if (isNaN(numericDuration) || numericDuration <= 0) {
      return NextResponse.json(
        { success: false, error: 'Durée invalide' },
        { status: 400 }
      );
    }

    // Create the service for the station with source = STATION
    const service = await db.service.create({
      data: {
        name,
        description: description || null,
        price: numericPrice,
        duration: numericDuration,
        category: category || 'standard',
        image: image || null,
        source: 'STATION',
        stationId: washer.stationId,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      service,
    });
  } catch (error) {
    console.error('Create station service error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du service' },
      { status: 500 }
    );
  }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
