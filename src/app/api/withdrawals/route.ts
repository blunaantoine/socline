import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/withdrawals - Get washer withdrawals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('washerId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID laveur requis' },
        { status: 400 }
      );
    }

    // Get washer by userId
    const washer = await db.washer.findUnique({
      where: { userId },
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { washerId, amount, phoneNumber, operator } = body;

    // Validate required fields
    if (!washerId || !amount || !phoneNumber || !operator) {
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

    // Get washer data
    const washer = await db.washer.findUnique({
      where: { userId: washerId },
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
