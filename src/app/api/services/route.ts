import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/services - Get all active services
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('stationId');

    const where: any = { isActive: true };
    if (stationId) {
      where.stationId = stationId;
    }

    const services = await db.service.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    return NextResponse.json({ success: true, services });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement des services' }, { status: 500 });
  }
}
