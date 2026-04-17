import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/stations - Get all stations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseFloat(searchParams.get('radius') || '50'); // km

    let stations = await db.station.findMany({
      where: { isActive: true },
      include: {
        washers: {
          where: { isAvailable: true },
          select: { id: true },
        },
      },
    });

    // Calculate distances and filter by radius
    if (latitude && longitude) {
      stations = stations
        .map((station) => ({
          ...station,
          distance: calculateDistance(
            latitude,
            longitude,
            station.latitude,
            station.longitude
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

// POST /api/stations - Create new station (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, address, latitude, longitude, phone, email, images } = body;

    if (!name || !address || !latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const station = await db.station.create({
      data: {
        name,
        description,
        address,
        latitude,
        longitude,
        phone,
        email,
        images: images ? JSON.stringify(images) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      station,
    });
  } catch (error) {
    console.error('Create station error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create station' },
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
