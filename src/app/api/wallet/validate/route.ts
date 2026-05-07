import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/wallet/validate - Get all pending deposit requests
export async function GET(request: NextRequest) {
  try {
    const pendingDeposits = await db.walletTransaction.findMany({
      where: {
        type: 'DEPOSIT',
        status: 'PENDING',
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      deposits: pendingDeposits,
    });
  } catch (error) {
    console.error('Get pending deposits error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/wallet/validate - Validate or reject a deposit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, action } = body; // action: 'validate' or 'reject'

    if (!transactionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Get the transaction
    const transaction = await db.walletTransaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }

    if (transaction.status !== 'PENDING') {
      return NextResponse.json({ error: 'Transaction déjà traitée' }, { status: 400 });
    }

    if (action === 'validate') {
      // Update transaction status
      const updatedTransaction = await db.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          balanceAfter: transaction.wallet.balance + transaction.amount,
        },
      });

      // Update wallet balance
      const updatedWallet = await db.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: { increment: transaction.amount },
          totalDeposited: { increment: transaction.amount },
        },
      });

      // Create notification for user
      await db.notification.create({
        data: {
          userId: transaction.wallet.userId,
          title: 'Rechargement validé',
          message: `Votre rechargement de ${transaction.amount.toLocaleString()} F a été validé.`,
          type: 'payment',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Rechargement validé',
        transaction: updatedTransaction,
        wallet: updatedWallet,
      });
    } else if (action === 'reject') {
      // Update transaction status
      const updatedTransaction = await db.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          description: `${transaction.description} - Rejeté`,
        },
      });

      // Create notification for user
      await db.notification.create({
        data: {
          userId: transaction.wallet.userId,
          title: 'Rechargement échoué',
          message: `Votre demande de rechargement de ${transaction.amount.toLocaleString()} F a été rejetée.`,
          type: 'payment',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Rechargement rejeté',
        transaction: updatedTransaction,
      });
    } else {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('Validate deposit error:', error);
    return NextResponse.json({ error: 'Erreur lors de la validation' }, { status: 500 });
  }
}
