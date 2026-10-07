import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Valid coverage values — EXTERIOR = outside only, FULL = exterior + interior
const VALID_COVERAGES = ['EXTERIOR', 'FULL'];

// GET /api/services/[id] - Get a single service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = await db.service.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error('Get service error:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement du service' }, { status: 500 });
  }
}

// PATCH /api/services/[id] - Update a service
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { name, description, price, duration, category, isActive, coverage } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseInt(price);
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (coverage !== undefined) {
      if (!VALID_COVERAGES.includes(coverage)) {
        return NextResponse.json(
          { success: false, error: 'Prestation invalide (EXTERIOR ou FULL)' },
          { status: 400 }
        );
      }
      updateData.coverage = coverage;
    }

    const service = await db.service.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error('Update service error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du service' }, { status: 500 });
  }
}

// DELETE /api/services/[id] - Delete a service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete service error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression du service' }, { status: 500 });
  }
}
