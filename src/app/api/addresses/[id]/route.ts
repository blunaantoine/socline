import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PUT /api/addresses/[id] - Update address
// Identity is derived from the session cookie: the address must belong
// to the session user (body userId is ignored), otherwise 404.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id } = await params;
    const body = await request.json();
    const { label, type, address, latitude, longitude, instructions, isDefault } = body;

    // Verify ownership (address must belong to the session user)
    const existing = await db.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
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
// Identity is derived from the session cookie: the address must belong
// to the session user (query userId is ignored), otherwise 404.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { id } = await params;

    // Verify ownership (address must belong to the session user)
    const existing = await db.address.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Adresse non trouvée' }, { status: 404 });
    }

    await db.address.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete address error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
