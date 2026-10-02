import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/user/activity - Get user activity history
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all, orders, transactions, subscriptions
    const limit = parseInt(searchParams.get('limit') || '50');

    const activities: any[] = [];

    // Fetch orders
    if (type === 'all' || type === 'orders') {
      const orders = await db.order.findMany({
        where: { clientId: userId },
        include: {
          service: { select: { name: true } },
          washer: {
            include: {
              user: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      orders.forEach(order => {
        activities.push({
          id: order.id,
          type: 'ORDER',
          title: `Commande #${order.orderNumber}`,
          description: `${order.service.name} - ${order.totalPrice.toLocaleString()} XOF`,
          status: order.status,
          amount: order.totalPrice,
          date: order.createdAt,
          data: order
        });
      });
    }

    // Fetch wallet transactions
    if (type === 'all' || type === 'transactions') {
      const wallet = await db.wallet.findUnique({ where: { userId } });
      if (wallet) {
        const transactions = await db.walletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: 'desc' },
          take: limit
        });

        transactions.forEach(tx => {
          let title = '';
          let description = '';

          switch (tx.type) {
            case 'DEPOSIT':
              title = 'Rechargement';
              description = `Via ${tx.paymentMethod || 'Mobile Money'}`;
              break;
            case 'WITHDRAWAL':
              title = 'Retrait';
              description = 'Retrait du portefeuille';
              break;
            case 'PAYMENT':
              title = 'Paiement';
              description = 'Paiement de commande';
              break;
            case 'REFUND':
              title = 'Remboursement';
              description = 'Remboursement reçu';
              break;
            case 'BONUS':
              title = 'Bonus';
              description = tx.description || 'Bonus reçu';
              break;
          }

          activities.push({
            id: tx.id,
            type: 'TRANSACTION',
            title,
            description,
            status: tx.status,
            amount: tx.amount,
            transactionType: tx.type,
            date: tx.createdAt,
            data: tx
          });
        });
      }
    }

    // Fetch subscription activities
    if (type === 'all' || type === 'subscriptions') {
      const subscriptions = await db.userSubscription.findMany({
        where: { userId },
        include: {
          plan: { select: { name: true, displayName: true } },
          usages: {
            orderBy: { usedAt: 'desc' },
            take: 10
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      subscriptions.forEach(sub => {
        // Subscription activation
        activities.push({
          id: sub.id,
          type: 'SUBSCRIPTION',
          title: `Abonnement ${sub.plan.name}`,
          description: `${sub.plan.displayName} - ${sub.paidAmount.toLocaleString()} XOF`,
          status: sub.isActive ? 'ACTIVE' : 'EXPIRED',
          amount: sub.paidAmount,
          date: sub.createdAt,
          data: sub
        });

        // Subscription usages
        sub.usages.forEach(usage => {
          activities.push({
            id: usage.id,
            type: 'SUBSCRIPTION_USE',
            title: 'Lavage utilisé',
            description: usage.serviceName,
            status: 'COMPLETED',
            date: usage.usedAt,
            data: usage
          });
        });
      });
    }

    // Sort all activities by date
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      activities: activities.slice(0, limit)
    });
  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
