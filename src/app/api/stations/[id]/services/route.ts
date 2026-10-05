import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/stations/[id]/services - List services for a specific station
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check that the station exists
    const station = await db.station.findUnique({
      where: { id },
      select: { id: true, isActive: true, name: true },
    });

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station introuvable' },
        { status: 404 }
      );
    }

    // Return only active services for this station (STATION source services)
    const services = await db.service.findMany({
      where: {
        stationId: id,
        isActive: true,
        source: 'STATION',
      },
      orderBy: { price: 'asc' },
    });

    return NextResponse.json({
      success: true,
      station: {
        id: station.id,
        name: station.name,
      },
      services,
    });
  } catch (error) {
    console.error('Get station services error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des services de la station' },
      { status: 500 }
    );
  }
}

// POST /api/stations/[id]/services - Create a new service for the station (owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Verify the station exists
    const station = await db.station.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station introuvable' },
        { status: 404 }
      );
    }

    // Verify ownership: the washer must be linked to this station
    if (washer.stationId !== id) {
      return NextResponse.json(
        { success: false, error: 'Vous n\'êtes pas autorisé à créer des services pour cette station' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, price, duration, category, image, coverage } = body;

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
        coverage: coverage === 'EXTERIOR' ? 'EXTERIOR' : 'FULL',
        source: 'STATION',
        stationId: id,
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
