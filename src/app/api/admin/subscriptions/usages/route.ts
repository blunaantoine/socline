import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/subscriptions/usages
 * Get all subscription usages with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'PENDING', 'VALIDATED', 'CANCELLED', 'all'
    const subscriptionId = searchParams.get('subscriptionId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (subscriptionId) {
      where.subscriptionId = subscriptionId;
    }

    // Get usages
    const [usages, total] = await Promise.all([
      db.subscriptionUsage.findMany({
        where,
        include: {
          subscription: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
              plan: {
                select: {
                  name: true,
                  displayName: true,
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              washer: {
                select: {
                  id: true,
                  user: {
                    select: {
                      name: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { usedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.subscriptionUsage.count({ where }),
    ]);

    // Get stats
    const stats = await db.subscriptionUsage.groupBy({
      by: ['status'],
      _count: true,
    });

    return NextResponse.json({
      success: true,
      usages: usages.map(usage => ({
        id: usage.id,
        subscriptionId: usage.subscriptionId,
        orderId: usage.orderId,
        usedAt: usage.usedAt,
        serviceName: usage.serviceName,
        washType: usage.washType,
        address: usage.address,
        status: usage.status,
        validatedAt: usage.validatedAt,
        validatedBy: usage.validatedBy,
        adminNotes: usage.adminNotes,
        createdAt: usage.createdAt,
        subscription: usage.subscription,
        order: usage.order,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: stats.find(s => s.status === 'PENDING')?._count || 0,
        validated: stats.find(s => s.status === 'VALIDATED')?._count || 0,
        cancelled: stats.find(s => s.status === 'CANCELLED')?._count || 0,
      },
    });
  } catch (error) {
    console.error('Get subscription usages error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/subscriptions/usages
 * Admin action on a usage (validate, cancel, add notes)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { usageId, action, notes } = body;

    if (!usageId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const usage = await db.subscriptionUsage.findUnique({
      where: { id: usageId },
      include: {
        subscription: true,
        order: true,
      },
    });

    if (!usage) {
      return NextResponse.json({ error: 'Utilisation non trouvée' }, { status: 404 });
    }

    if (action === 'VALIDATE') {
      // Check if already validated
      if (usage.status === 'VALIDATED') {
        return NextResponse.json({ error: 'Cette séance est déjà validée' }, { status: 400 });
      }

      const result = await db.$transaction(async (tx) => {
        // Update usage status
        const updatedUsage = await tx.subscriptionUsage.update({
          where: { id: usageId },
          data: {
            status: 'VALIDATED',
            validatedAt: new Date(),
            adminNotes: notes || 'Validé par admin',
          },
        });

        // Update order if exists
        if (usage.orderId) {
          await tx.order.update({
            where: { id: usage.orderId },
            data: {
              subscriptionValidated: true,
              subscriptionValidatedAt: new Date(),
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }

        // Deduct from subscription (if not already deducted)
        if (usage.subscription.remainingWashes > 0) {
          await tx.userSubscription.update({
            where: { id: usage.subscriptionId },
            data: {
              usedWashes: { increment: 1 },
              remainingWashes: { decrement: 1 },
            },
          });
        }

        return updatedUsage;
      });

      return NextResponse.json({
        success: true,
        message: 'Séance validée avec succès',
        usage: result,
      });
    }

    if (action === 'CANCEL') {
      // Cancel the usage
      const result = await db.$transaction(async (tx) => {
        // Update usage
        const updatedUsage = await tx.subscriptionUsage.update({
          where: { id: usageId },
          data: {
            status: 'CANCELLED',
            adminNotes: notes || 'Annulé par admin',
          },
        });

        // Update order if exists
        if (usage.orderId) {
          await tx.order.update({
            where: { id: usage.orderId },
            data: {
              isSubscriptionOrder: false,
              subscriptionId: null,
            },
          });
        }

        // If was validated before, restore the wash count
        if (usage.status === 'VALIDATED') {
          await tx.userSubscription.update({
            where: { id: usage.subscriptionId },
            data: {
              usedWashes: { decrement: 1 },
              remainingWashes: { increment: 1 },
            },
          });
        }

        return updatedUsage;
      });

      return NextResponse.json({
        success: true,
        message: 'Séance annulée',
        usage: result,
      });
    }

    if (action === 'ADD_NOTES') {
      const result = await db.subscriptionUsage.update({
        where: { id: usageId },
        data: {
          adminNotes: notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Notes ajoutées',
        usage: result,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Admin subscription usage action error:', error);
    return NextResponse.json({ error: 'Erreur lors du traitement' }, { status: 500 });
  }
}
