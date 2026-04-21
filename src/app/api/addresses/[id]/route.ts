import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/addresses/[id] - Update address
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, label, type, address, latitude, longitude, instructions, isDefault } = body;

    // Verify ownership
    const existing = await db.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Adresse non trouvée' }, { status: 404 });
    }

    // If this is default, remove default from other addresses
    if (isDefault) {
      await db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updated = await db.address.update({
      where: { id },
      data: {
        label,
        type,
        address,
        latitude,
        longitude,
        instructions,
        isDefault
      }
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    console.error('Update address error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

// DELETE /api/addresses/[id] - Delete address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Verify ownership
    const existing = await db.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Adresse non trouvée' }, { status: 404 });
    }

    await db.address.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete address error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
