import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/services - Get all services
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const stationId = searchParams.get('stationId');

    const where: any = { isActive: true };
    
    if (category) {
      where.category = category;
    }
    if (stationId) {
      where.stationId = stationId;
    }

    const services = await db.service.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    return NextResponse.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get services' },
      { status: 500 }
    );
  }
}

// POST /api/services - Create new service (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, price, duration, category, image, stationId } = body;

    if (!name || !price || !duration) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const service = await db.service.create({
      data: {
        name,
        description,
        price,
        duration,
        category: category || 'basic',
        image,
        stationId,
      },
    });

    return NextResponse.json({
      success: true,
      service,
    });
  } catch (error) {
    console.error('Create service error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
