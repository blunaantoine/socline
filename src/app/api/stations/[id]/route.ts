import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/stations/[id] - Get a single station by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const station = await db.station.findUnique({
      where: { id },
      include: {
        washers: {
          select: { id: true, isAvailable: true },
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

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      station,
    });
  } catch (error) {
    console.error('Get station error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement de la station' },
      { status: 500 }
    );
  }
}

// PATCH /api/stations/[id] - Update station info (owner only)
export async function PATCH(
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
      select: { id: true, washerType: true, stationId: true },
    });

    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Aucun profil de laveur trouvé pour cet utilisateur' },
        { status: 404 }
      );
    }

    // Only STATION_OWNER washers can edit station info
    if (washer.washerType !== 'STATION_OWNER') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires de station peuvent modifier une station' },
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
        { success: false, error: 'Vous n\'êtes pas autorisé à modifier cette station' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, address, phone, email, latitude, longitude, images, isActive } = body;

    // Build the update payload - only set provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (images !== undefined) updateData.images = images;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.station.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      station: updated,
    });
  } catch (error) {
    console.error('Update station error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la station' },
      { status: 500 }
    );
  }
}
