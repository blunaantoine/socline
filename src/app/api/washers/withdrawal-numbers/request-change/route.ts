import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';

// POST /api/washers/withdrawal-numbers/request-change
// The washer sends a modification request for their trusted withdrawal
// numbers (e.g. "replace 90xxxxxx by 91xxxxxx"). MODIFICATION IS ADMIN-ONLY:
// this endpoint does NOT touch the numbers — it notifies every ADMIN
// (in-app + realtime + SMS best-effort) so they can act in the admin panel.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const message = String(body?.message ?? '').trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Veuillez décrire votre demande' },
        { status: 400 }
      );
    }

    const washer = await db.washer.findUnique({
      where: { userId: auth.user!.id },
      include: { user: { select: { name: true, phone: true } } },
    });

    if (!washer) {
      return NextResponse.json(
        { success: false, error: 'Laveur non trouvé' },
        { status: 404 }
      );
    }

    const currentNumbers = await db.washerWithdrawalNumber.findMany({
      where: { washerId: washer.id },
      orderBy: { createdAt: 'asc' },
    });

    const currentList = currentNumbers
      .map((n) => `+228${n.phoneNumber} (${n.operator ?? '—'})`)
      .join(', ') || 'aucun numéro';

    const admins = await db.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, phone: true },
    });

    for (const admin of admins) {
      await notify({
        userId: admin.id,
        type: 'system',
        title: 'Demande de modification — numéros de retrait 🔧',
        message: `${washer.user.name} (${washer.user.phone ?? '—'}) demande : « ${message.slice(0, 300)} ». Numéros actuels : ${currentList}.`,
        data: {
          washerId: washer.id,
          washerName: washer.user.name,
          currentNumbers: currentNumbers.map((n) => n.phoneNumber),
        },
        sms: admin.phone
          ? {
              phone: admin.phone,
              text: `Socline: ${washer.user.name} demande une modif de ses numeros de retrait: ${message.slice(0, 80)}`,
            }
          : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Votre demande a été envoyée à l\'administrateur. Seul l\'administrateur peut modifier vos numéros de retrait.',
    });
  } catch (error) {
    console.error('Withdrawal number change request error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'envoi de la demande' },
      { status: 500 }
    );
  }
}
