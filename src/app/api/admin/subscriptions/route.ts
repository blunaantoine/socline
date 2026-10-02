import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/admin/subscriptions
 * Get all subscriptions with filtering and pagination
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'expired', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status === 'active') {
      where.isActive = true;
      where.isExpired = false;
      where.endDate = { gte: new Date() };
    } else if (status === 'expired') {
      where.OR = [
        { isExpired: true },
        { endDate: { lt: new Date() } }
      ];
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { phone: { contains: search } } },
        { plan: { name: { contains: search } } },
      ];
    }

    // Get subscriptions with count
    const [subscriptions, total] = await Promise.all([
      db.userSubscription.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              displayName: true,
              service: {
                select: { name: true },
              },
            },
          },
          usages: {
            orderBy: { usedAt: 'desc' },
            take: 5,
          },
          _count: {
            select: { usages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.userSubscription.count({ where }),
    ]);

    // Get pending validations count
    const pendingValidations = await db.subscriptionUsage.count({
      where: { status: 'PENDING' },
    });

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        user: sub.user,
        plan: sub.plan,
        duration: sub.duration,
        paidAmount: sub.paidAmount,
        totalWashes: sub.totalWashes,
        usedWashes: sub.usedWashes,
        remainingWashes: sub.remainingWashes,
        freeOptionsUsed: sub.freeOptionsUsed,
        freeOptionsTotal: sub.freeOptionsTotal,
        bonusWashEarned: sub.bonusWashEarned,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        isExpired: sub.isExpired,
        autoRenew: sub.autoRenew,
        paymentMethod: sub.paymentMethod,
        createdAt: sub.createdAt,
        recentUsages: sub.usages,
        totalUsages: sub._count.usages,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pendingValidations,
        totalActive: await db.userSubscription.count({
          where: { isActive: true, isExpired: false, endDate: { gte: new Date() } },
        }),
        totalExpired: await db.userSubscription.count({
          where: { OR: [{ isExpired: true }, { endDate: { lt: new Date() } }] },
        }),
      },
    });
  } catch (error) {
    console.error('Get admin subscriptions error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/admin/subscriptions
 * Create a subscription for a user (admin override)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { userId, planId, duration, paymentMethod, paidAmount, startDate } = body;

    if (!userId || !planId) {
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
    let price = paidAmount || plan.price;
    let daysValid = 30;
    let totalWashes = plan.washCount;

    switch (duration) {
      case 'QUARTERLY':
        price = paidAmount || plan.quarterlyPrice || plan.price * 3 * 0.9;
        daysValid = 90;
        totalWashes = plan.washCount * 3;
        break;
      case 'YEARLY':
        price = paidAmount || plan.yearlyPrice || plan.price * 12 * 0.8;
        daysValid = 365;
        totalWashes = plan.washCount * 12;
        break;
    }

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
        error: 'L\'utilisateur a déjà un abonnement actif',
        activeSubscription: existingActive,
      }, { status: 400 });
    }

    // Create subscription
    const now = startDate ? new Date(startDate) : new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysValid);

    const subscription = await db.userSubscription.create({
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
        paymentMethod: paymentMethod || 'CASH',
        isActive: true,
        isExpired: false,
      },
      include: {
        user: true,
        plan: true,
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('Create admin subscription error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/subscriptions
 * Update a subscription (extend, adjust washes, etc.)
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { subscriptionId, action, data } = body;

    if (!subscriptionId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const subscription = await db.userSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Abonnement non trouvé' }, { status: 404 });
    }

    let result;

    switch (action) {
      case 'EXTEND':
        // Extend subscription by X days
        const extendDays = data?.days || 30;
        const newEndDate = new Date(subscription.endDate);
        newEndDate.setDate(newEndDate.getDate() + extendDays);
        
        result = await db.userSubscription.update({
          where: { id: subscriptionId },
          data: {
            endDate: newEndDate,
            isActive: true,
            isExpired: false,
          },
        });
        break;

      case 'ADD_WASHES':
        // Add washes to subscription
        const addWashes = data?.washes || 1;
        result = await db.userSubscription.update({
          where: { id: subscriptionId },
          data: {
            totalWashes: { increment: addWashes },
            remainingWashes: { increment: addWashes },
          },
        });
        break;

      case 'DEACTIVATE':
        result = await db.userSubscription.update({
          where: { id: subscriptionId },
          data: {
            isActive: false,
          },
        });
        break;

      case 'REACTIVATE':
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + 30);
        result = await db.userSubscription.update({
          where: { id: subscriptionId },
          data: {
            isActive: true,
            isExpired: false,
            endDate: newEnd,
          },
        });
        break;

      default:
        return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      subscription: result,
    });
  } catch (error) {
    console.error('Update admin subscription error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
