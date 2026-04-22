import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/user/profile - Update user profile (phone and PIN only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, phone, pin, currentPin } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    // Get current user
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // If changing PIN, verify current PIN
    if (pin && currentPin) {
      if (user.pin !== currentPin) {
        return NextResponse.json({ error: 'PIN actuel incorrect' }, { status: 400 });
      }
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json({ error: 'Le PIN doit contenir exactement 4 chiffres' }, { status: 400 });
      }
    }

    // If changing phone, validate and check uniqueness
    if (phone && phone !== user.phone) {
      // Validate Togo phone number (starts with 7 or 9, 8 digits)
      if (!/^[79]\d{7}$/.test(phone)) {
        return NextResponse.json({ error: 'Numéro invalide (doit commencer par 7 ou 9, 8 chiffres)' }, { status: 400 });
      }

      // Check if phone is already used
      const existing = await db.user.findUnique({ where: { phone } });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: 'Ce numéro est déjà utilisé' }, { status: 400 });
      }
    }

    // Build update data
    const updateData: { phone?: string; pin?: string } = {};
    if (phone) updateData.phone = phone;
    if (pin) updateData.pin = pin;

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true
      }
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
