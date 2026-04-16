import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/washers - Get washers (with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const available = searchParams.get('available');
    const verified = searchParams.get('verified');
    const latitude = parseFloat(searchParams.get('latitude') || '0');
    const longitude = parseFloat(searchParams.get('longitude') || '0');
    const radius = parseFloat(searchParams.get('radius') || '10'); // km
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    
    if (available === 'true') {
      where.isAvailable = true;
    }
    if (verified === 'true') {
      where.isVerified = true;
    }

    let washers = await db.washer.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, avatar: true } },
        station: true,
      },
      take: limit,
    });

    // Filter by distance if coordinates provided
    if (latitude && longitude) {
      washers = washers.filter((washer) => {
        if (!washer.latitude || !washer.longitude) return false;
        
        const distance = calculateDistance(
          latitude,
          longitude,
          washer.latitude,
          washer.longitude
        );
        
        // Add distance to washer object
        (washer as any).distance = distance;
        
        return distance <= radius;
      });

      // Sort by distance
      washers.sort((a, b) => ((a as any).distance || 0) - ((b as any).distance || 0));
    }

    return NextResponse.json({
      success: true,
      washers,
    });
  } catch (error) {
    console.error('Get washers error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get washers' },
      { status: 500 }
    );
  }
}

// PATCH /api/washers - Update washer status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { washerId, isAvailable, latitude, longitude } = body;

    if (!washerId) {
      return NextResponse.json(
        { success: false, error: 'Washer ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;

    const washer = await db.washer.update({
      where: { id: washerId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({
      success: true,
      washer,
    });
  } catch (error) {
    console.error('Update washer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update washer' },
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
