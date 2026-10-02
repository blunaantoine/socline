import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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
        phoneNumber,
        operator,
        status: 'PENDING',
      },
    });

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
