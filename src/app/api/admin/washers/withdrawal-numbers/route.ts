import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { notify } from '@/lib/notify';

// Trusted withdrawal numbers — ADMIN management.
//
// The washer can only ADD numbers during initial setup (max 3). Any later
// modification (add after the limit / removal / replacement) is ADMIN-ONLY,
// following a washer request. The washer is notified of every admin action.

const MAX_NUMBERS = 3;
const TOGO_8_DIGITS = /^\d{8}$/;

// GET /api/admin/washers/withdrawal-numbers?washerId=...
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const { searchParams } = new URL(request.url);
    const washerId = searchParams.get('washerId');
    if (!washerId) {
      return NextResponse.json({ success: false, error: 'washerId requis' }, { status: 400 });
    }

    const numbers = await db.washerWithdrawalNumber.findMany({
      where: { washerId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, numbers, maxNumbers: MAX_NUMBERS });
  } catch (error) {
    console.error('Get withdrawal numbers (admin) error:', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/washers/withdrawal-numbers — add a number for a washer.
export async function POST(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { washerId, phoneNumber, operator, label } = body ?? {};

    if (!washerId) {
      return NextResponse.json({ success: false, error: 'washerId requis' }, { status: 400 });
    }

    const raw = String(phoneNumber ?? '').replace(/[\s\-().]/g, '');
    if (!TOGO_8_DIGITS.test(raw)) {
      return NextResponse.json(
        { success: false, error: 'Numéro invalide — 8 chiffres requis (ex: 90123456)' },
        { status: 400 }
      );
    }

    const washer = await db.washer.findUnique({
      where: { id: washerId },
      select: { id: true, userId: true, user: { select: { name: true } } },
    });
    if (!washer) {
      return NextResponse.json({ success: false, error: 'Laveur non trouvé' }, { status: 404 });
    }

    const existing = await db.washerWithdrawalNumber.findMany({
      where: { washerId },
      orderBy: { createdAt: 'asc' },
    });

    if (existing.length >= MAX_NUMBERS) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_NUMBERS} numéros par laveur` },
        { status: 400 }
      );
    }

    if (existing.some((n) => n.phoneNumber === raw)) {
      return NextResponse.json(
        { success: false, error: 'Ce numéro est déjà enregistré' },
        { status: 400 }
      );
    }

    const number = await db.washerWithdrawalNumber.create({
      data: {
        washerId,
        phoneNumber: raw,
        operator: operator === 'Flooz' ? 'Flooz' : 'Mixx by Yas',
        label: label ? String(label).slice(0, 60) : null,
      },
    });

    // Notify the washer (in-app + realtime; SMS only for critical events —
    // a number addition is handled in-app).
    await notify({
      userId: washer.userId,
      type: 'payment',
      title: 'Numéro de retrait ajouté ✅',
      message: `Un numéro de retrait +228${raw} a été ajouté à votre compte par l'administrateur.`,
      data: { phoneNumber: raw },
    });

    return NextResponse.json({ success: true, number });
  } catch (error) {
    console.error('Add withdrawal number (admin) error:', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/admin/washers/withdrawal-numbers — remove a number (id in body).
export async function DELETE(request: NextRequest) {
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const { id } = body ?? {};

    if (!id) {
      return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 });
    }

    const number = await db.washerWithdrawalNumber.findUnique({
      where: { id },
      include: { washer: { select: { userId: true } } },
    });

    if (!number) {
      return NextResponse.json({ success: false, error: 'Numéro non trouvé' }, { status: 404 });
    }

    await db.washerWithdrawalNumber.delete({ where: { id } });

    // Notify the washer.
    await notify({
      userId: number.washer.userId,
      type: 'payment',
      title: 'Numéro de retrait retiré',
      message: `Le numéro de retrait +228${number.phoneNumber} a été retiré de votre compte par l'administrateur.`,
      data: { phoneNumber: number.phoneNumber },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete withdrawal number (admin) error:', error);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}
