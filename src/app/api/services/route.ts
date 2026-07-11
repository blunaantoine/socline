import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/services - Get all active services
// Query params:
//   - source: APP | STATION | ALL (default: APP) - Filter services by source
//   - stationId: string - Filter services by station (when source is STATION or ALL)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('stationId');
    const sourceParam = (searchParams.get('source') || 'APP').toUpperCase();

    // Normalize the source parameter
    const source: 'APP' | 'STATION' | 'ALL' =
      sourceParam === 'STATION' ? 'STATION' :
      sourceParam === 'ALL' ? 'ALL' :
      'APP';

    // Build the where clause
    const where: any = { isActive: true };

    // Default behavior: return APP services only (for independent washers)
    if (source === 'APP') {
      where.source = 'APP';
    } else if (source === 'STATION') {
      where.source = 'STATION';
    }
    // When source === 'ALL', no source filter is applied (returns both APP and STATION services)

    // Optional station filter
    if (stationId) {
      where.stationId = stationId;
    }

    // Include station info for STATION services (useful for clients browsing)
    const include: any = source === 'APP' ? undefined : {
      station: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          phone: true,
          isActive: true,
        },
      },
    };

    const services = await db.service.findMany({
      where,
      include,
      orderBy: { price: 'asc' },
    });

    return NextResponse.json({ success: true, services, source });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des services' },
      { status: 500 }
    );
  }
}
