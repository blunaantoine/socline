import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/deposits - Get all pending deposits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const transactions = await db.walletTransaction.findMany({
      where: {
        type: 'DEPOSIT',
        status: status as any,
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedDeposits = transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      phoneNumber: tx.phoneNumber,
      paymentMethod: tx.paymentMethod,
      description: tx.description,
      externalRef: tx.externalRef,
      createdAt: tx.createdAt,
      user: tx.wallet.user,
    }));

    return NextResponse.json({
      success: true,
      deposits: formattedDeposits,
    });
  } catch (error) {
    console.error('Get deposits error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/deposits - Validate or reject a deposit
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: 'Cette transaction a déjà été traitée' }, { status: 400 });
    }

    if (action === 'validate') {
      // Update transaction status to COMPLETED
      const updatedTransaction = await db.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          description: `Rechargement validé via ${transaction.paymentMethod}`,
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
          message: `Votre rechargement de ${transaction.amount.toLocaleString()} F a été validé avec succès.`,
          type: 'PAYMENT',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Rechargement validé avec succès',
        transaction: updatedTransaction,
        wallet: updatedWallet,
      });
    } else if (action === 'reject') {
      // Update transaction status to FAILED
      const updatedTransaction = await db.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          description: `Rechargement échoué via ${transaction.paymentMethod}`,
        },
      });

      // Create notification for user
      await db.notification.create({
        data: {
          userId: transaction.wallet.userId,
          title: 'Rechargement échoué',
          message: `Votre demande de rechargement de ${transaction.amount.toLocaleString()} F a échoué. Veuillez réessayer.`,
          type: 'PAYMENT',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Rechargement marqué comme échoué',
        transaction: updatedTransaction,
      });
    } else {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('Update deposit error:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement' }, { status: 500 });
  }
}
