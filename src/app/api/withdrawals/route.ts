import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';

// GET /api/withdrawals - Get washer withdrawals
// Identity is derived from the session cookie (query washerId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    // Get washer for the session user
    const washer = await db.washer.findUnique({
      where: { userId: auth.user!.id },
    });

    if (!washer) {
      return NextResponse.json({
        success: true,
        withdrawals: [],
      });
    }

    const withdrawals = await db.washerWithdrawal.findMany({
      where: { washerId: washer.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des retraits' },
      { status: 500 }
    );
  }
}

// POST /api/withdrawals - Create withdrawal request
// Identity is derived from the session cookie (body washerId is ignored).
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const { amount, phoneNumber, operator } = body;

    // Validate required fields
    if (!amount || !phoneNumber || !operator) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount < 500) {
      return NextResponse.json(
        { success: false, error: 'Le montant minimum est de 500 XOF' },
        { status: 400 }
      );
    }

    // Get washer data for the session user
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

    // Check balance
    if (washer.totalEarnings < amount) {
      return NextResponse.json(
        { success: false, error: 'Solde insuffisant' },
        { status: 400 }
      );
    }

    // SECURITY — the withdrawal can ONLY target one of the washer's trusted
    // numbers (max 3, self-confirmed at setup; admin-only modifications).
    const rawPhone = String(phoneNumber).replace(/[\s\-().]/g, '');
    const trustedNumbers = await db.washerWithdrawalNumber.findMany({
      where: { washerId: washer.id },
      select: { phoneNumber: true, operator: true },
    });

    const trusted = trustedNumbers.find((n) => n.phoneNumber === rawPhone);
    if (!trusted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ce numéro n\'est pas un numéro de retrait confirmé. Utilisez l\'un de vos numéros enregistrés ou demandez une modification à l\'administrateur.',
        },
        { status: 403 }
      );
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await db.washerWithdrawal.findFirst({
      where: {
        washerId: washer.id,
        status: 'PENDING',
      },
    });

    if (pendingWithdrawal) {
      return NextResponse.json(
        { success: false, error: 'Vous avez déjà une demande de retrait en attente' },
        { status: 400 }
      );
    }

    // No fee
    const fee = 0;

    // Create withdrawal request
    const withdrawal = await db.washerWithdrawal.create({
      data: {
        washerId: washer.id,
        amount,
        fee,
        phoneNumber: rawPhone,
        operator: trusted.operator ?? operator,
        status: 'PENDING',
      },
    });

    // Notifications — the washer gets a confirmation and EVERY active admin
    // is alerted (in-app + realtime + SMS best-effort) so the request can be
    // processed from the admin panel.
    try {
      const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

      await notify({
        userId: auth.user!.id,
        type: 'payment',
        title: 'Demande de retrait envoyée ✅',
        message: `Votre demande de retrait de ${fmt(amount)} XOF vers +228${rawPhone} (${trusted.operator ?? operator}) est en attente de validation.`,
        data: { withdrawalId: withdrawal.id, amount },
      });

      const admins = await db.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, phone: true },
      });

      for (const admin of admins) {
        await notify({
          userId: admin.id,
          type: 'payment',
          title: 'Nouvelle demande de retrait 💰',
          message: `${washer.user?.name ?? 'Un laveur'} demande un retrait de ${fmt(amount)} XOF vers +228${rawPhone} (${trusted.operator ?? operator}). Ouvrez Retraits Laveurs pour traiter.`,
          data: { withdrawalId: withdrawal.id, amount, washerId: washer.id },
          sms: admin.phone
            ? {
                phone: admin.phone,
                text: `Socline: Nouvelle demande de retrait ${fmt(amount)} XOF de ${washer.user?.name ?? 'laveur'} vers +228${rawPhone}.`,
              }
            : undefined,
        });
      }
    } catch (error) {
      console.warn('[Withdrawals] notification failed:', error);
    }

    return NextResponse.json({
      success: true,
      withdrawal,
      message: 'Demande de retrait envoyée avec succès',
    });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du retrait' },
      { status: 500 }
    );
  }
}
