import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/subscriptions/user - Get user's subscriptions
// Identity is derived from the session cookie (query userId is ignored).
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const subscriptions = await db.userSubscription.findMany({
      where: { userId },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        usages: includeHistory
          ? {
              orderBy: { usedAt: 'desc' },
              take: 20,
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check for expired subscriptions
    const now = new Date();
    for (const sub of subscriptions) {
      if (sub.endDate < now && sub.isActive && !sub.isExpired) {
        await db.userSubscription.update({
          where: { id: sub.id },
          data: { isActive: false, isExpired: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        plan: {
          ...sub.plan,
          features: sub.plan.features ? JSON.parse(sub.plan.features) : [],
        },
      })),
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/subscriptions/user - Subscribe to a plan
// (Structure unchanged by previous rework; only the userId is now derived
// from the session cookie — a body userId is ignored.)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response!;
  const userId = auth.user!.id;

  try {
    const body = await request.json();
    const { planId, duration, paymentMethod } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Get the plan
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId },
      include: { service: true },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan non disponible' }, { status: 400 });
    }

    // Calculate price and duration
    let price: number;
    let daysValid: number;
    let totalWashes = plan.washCount;

    switch (duration) {
      case 'QUARTERLY':
        price = plan.quarterlyPrice || plan.price * 3 * 0.9; // 10% discount
        daysValid = 90;
        totalWashes = plan.washCount * 3;
        break;
      case 'YEARLY':
        price = plan.yearlyPrice || plan.price * 12 * 0.8; // 20% discount
        daysValid = 365;
        totalWashes = plan.washCount * 12;
        break;
      default:
        price = plan.price;
        daysValid = 30;
    }

    // --- ALL VALIDATIONS BEFORE ANY WALLET DEBIT ---

    // Check for existing active subscription
    const existingActive = await db.userSubscription.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    if (existingActive) {
      return NextResponse.json({ 
        error: 'Vous avez déjà un abonnement actif',
        activeSubscription: existingActive,
      }, { status: 400 });
    }

    // Check wallet balance if payment method is WALLET (no debit yet)
    if (paymentMethod === 'WALLET') {
      const wallet = await db.wallet.findUnique({
        where: { userId },
      });

      if (!wallet || wallet.balance < price) {
        return NextResponse.json({ 
          error: 'Solde insuffisant',
          required: price,
          available: wallet?.balance || 0,
        }, { status: 400 });
      }
    }

    // Create subscription
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysValid);

    // Single atomic transaction: debit wallet + create WalletTransaction
    // + create UserSubscription. If anything fails, everything is rolled back.
    const subscription = await db.$transaction(async (tx) => {
      if (paymentMethod === 'WALLET') {
        // Re-read the wallet inside the transaction for consistency
        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet || wallet.balance < price) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        // Deduct from wallet
        await tx.wallet.update({
          where: { userId },
          data: {
            balance: { decrement: price },
            totalSpent: { increment: price },
          },
        });

        // Create transaction
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'PAYMENT',
            amount: -price,
            status: 'COMPLETED',
            description: `Abonnement ${plan.displayName} - ${duration || 'MONTHLY'}`,
            balanceAfter: wallet.balance - price,
          },
        });
      }

      return tx.userSubscription.create({
        data: {
          userId,
          planId,
          duration: duration || 'MONTHLY',
          paidAmount: price,
          totalWashes,
          usedWashes: 0,
          remainingWashes: totalWashes,
          freeOptionsTotal: plan.freeOptions * (duration === 'QUARTERLY' ? 3 : duration === 'YEARLY' ? 12 : 1),
          freeOptionsUsed: 0,
          startDate: now,
          endDate,
          paymentMethod: paymentMethod || 'WALLET',
          isActive: true,
          isExpired: false,
        },
        include: {
          plan: {
            include: { service: true },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        plan: {
          ...subscription.plan,
          features: subscription.plan.features ? JSON.parse(subscription.plan.features) : [],
        },
      },
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json({ error: 'Erreur lors de la souscription' }, { status: 500 });
  }
}

// PATCH /api/subscriptions/user - Use a wash from subscription
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, action, orderId, address, serviceName } = body;

    if (!subscriptionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const subscription = await db.userSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Abonnement non trouvé' }, { status: 400 });
    }

    if (!subscription.isActive || subscription.isExpired) {
      return NextResponse.json({ error: 'Abonnement non actif' }, { status: 400 });
    }

    if (action === 'USE_WASH') {
      if (subscription.remainingWashes <= 0) {
        return NextResponse.json({ error: 'Plus de lavages disponibles' }, { status: 400 });
      }

      // Determine wash type
      let washType = 'standard';
      if (subscription.bonusWashEarned && subscription.usedWashes >= subscription.totalWashes) {
        washType = 'bonus';
      }

      // NOTE: Do NOT deduct washes here! 
      // Washes will be deducted when the WASHER validates the session
      // This prevents double-counting between USE_WASH and validation

      // Create usage record with PENDING status
      // The washer will validate it after completing the wash
      const usage = await db.subscriptionUsage.create({
        data: {
          subscriptionId,
          orderId,
          serviceName: serviceName || subscription.plan.service?.name || 'Lavage',
          washType,
          address,
          status: 'PENDING', // Will be VALIDATED by washer
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Séance enregistrée. En attente de validation par le laveur.',
        remainingWashes: subscription.remainingWashes, // Not decremented yet
        bonusEarned: subscription.bonusWashEarned,
        usage,
      });
    }

    if (action === 'USE_FREE_OPTION') {
      if (subscription.freeOptionsUsed >= subscription.freeOptionsTotal) {
        return NextResponse.json({ error: 'Plus d\'options gratuites disponibles' }, { status: 400 });
      }

      const updated = await db.userSubscription.update({
        where: { id: subscriptionId },
        data: {
          freeOptionsUsed: { increment: 1 },
        },
      });

      return NextResponse.json({
        success: true,
        freeOptionsRemaining: subscription.freeOptionsTotal - updated.freeOptionsUsed,
      });
    }

    if (action === 'TOGGLE_AUTO_RENEW') {
      const updated = await db.userSubscription.update({
        where: { id: subscriptionId },
        data: {
          autoRenew: !subscription.autoRenew,
        },
      });

      return NextResponse.json({
        success: true,
        autoRenew: updated.autoRenew,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
