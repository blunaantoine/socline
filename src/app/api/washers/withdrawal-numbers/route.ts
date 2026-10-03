import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Trusted withdrawal numbers — WASHER self-service (initial setup only).
//
// Rules (as per product requirements):
//   - the washer may ADD up to 3 trusted numbers (self-confirmed at setup);
//   - afterwards, MODIFICATION/REMOVAL is ADMIN-ONLY, following a washer
//     request (see POST /api/washers/withdrawal-numbers/request-change);
//   - withdrawal requests can ONLY target one of these trusted numbers.

const MAX_NUMBERS = 3;
const TOGO_8_DIGITS = /^\d{8}$/;

async function sessionWasher(userId: string) {
  return db.washer.findUnique({
    where: { userId },
    include: { user: { select: { name: true, phone: true } } },
  });
}

// GET /api/washers/withdrawal-numbers — list the session washer's numbers.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const washer = await sessionWasher(auth.user!.id);
    if (!washer) {
      return NextResponse.json({ success: true, numbers: [] });
    }

    const numbers = await db.washerWithdrawalNumber.findMany({
      where: { washerId: washer.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      numbers,
      maxNumbers: MAX_NUMBERS,
      canModify: false, // modifications are admin-only (request needed)
    });
  } catch (error) {
    console.error('Get withdrawal numbers error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des numéros' },
      { status: 500 }
    );
  }
}

// POST /api/washers/withdrawal-numbers — add a trusted number (initial setup).
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { phoneNumber, operator, label } = body ?? {};

    const raw = String(phoneNumber ?? '').replace(/[\s\-().]/g, '');
    if (!TOGO_8_DIGITS.test(raw)) {
      return NextResponse.json(
        { success: false, error: 'Numéro invalide — 8 chiffres requis (ex: 90123456)' },
        { status: 400 }
      );
    }

    const washer = await sessionWasher(auth.user!.id);
    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Laveur non trouvé' },
        { status: 404 }
      );
    }

    const existing = await db.washerWithdrawalNumber.findMany({
      where: { washerId: washer.id },
      orderBy: { createdAt: 'asc' },
    });

    if (existing.length >= MAX_NUMBERS) {
      return NextResponse.json(
        {
          success: false,
          error: `Vous avez déjà ${MAX_NUMBERS} numéros confirmés. Pour en modifier un, envoyez une demande à l'administrateur.`,
        },
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
        washerId: washer.id,
        phoneNumber: raw,
        operator: operator === 'Flooz' ? 'Flooz' : 'Mixx by Yas',
        label: label ? String(label).slice(0, 60) : null,
      },
    });

    return NextResponse.json({ success: true, number });
  } catch (error) {
    console.error('Add withdrawal number error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'ajout du numéro' },
      { status: 500 }
    );
  }
}
