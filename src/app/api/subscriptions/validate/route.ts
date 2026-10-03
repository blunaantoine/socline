import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/subscriptions/validate?clientId=xxx
 * Check if a client has an active subscription (for washer to verify)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'ID client requis' }, { status: 400 });
    }

    // Get active subscription for this client
    const subscription = await db.userSubscription.findFirst({
      where: {
        userId: clientId,
        isActive: true,
        isExpired: false,
        endDate: { gte: new Date() },
        remainingWashes: { gt: 0 },
      },
      include: {
        plan: {
          include: { service: true },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({
        success: true,
        hasSubscription: false,
        message: 'Le client n\'a pas d\'abonnement actif',
      });
    }

    // Get pending usages for this subscription
    const pendingUsages = await db.subscriptionUsage.count({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        planName: subscription.plan.displayName,
        serviceName: subscription.plan.service?.name,
        remainingWashes: subscription.remainingWashes,
        totalWashes: subscription.totalWashes,
        usedWashes: subscription.usedWashes,
        endDate: subscription.endDate,
        priority: subscription.plan.priority,
        pendingUsages,
      },
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions/validate
 * Validate a subscription session (washer confirms the wash was done)
 * 
 * Body: { orderId: string, washerId: string, action: 'VALIDATE' | 'REJECT' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, washerId, action } = body;

    if (!orderId || !washerId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Get the order
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        subscriptionUsage: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Verify this is a subscription order
    if (!order.isSubscriptionOrder) {
      return NextResponse.json({ error: 'Cette commande n\'utilise pas d\'abonnement' }, { status: 400 });
    }

    // Resolve the washer profile from the session BEFORE comparing:
    // session.id is the User id, while order.washerId references the
    // Washer record id (they are different identifiers).
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const washerProfile = await db.washer.findFirst({
      where: { OR: [{ id: session.id }, { userId: session.id }] },
      select: { id: true, userId: true },
    });

    // Verify the washer is assigned to this order
    // (equivalent to `order.washerId !== washerProfile?.id`)
    if (!washerProfile || order.washerId !== washerProfile.id) {
      return NextResponse.json({ error: 'Vous n\'êtes pas assigné à cette commande' }, { status: 403 });
    }

    // Check if already validated
    if (order.subscriptionValidated) {
      return NextResponse.json({ error: 'Cette séance a déjà été validée' }, { status: 400 });
    }

    // Default action is validate
    const validationAction = action || 'VALIDATE';

    if (validationAction === 'VALIDATE') {
      // Use transaction to ensure data consistency
      const result = await db.$transaction(async (tx) => {
        // Update order
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            subscriptionValidated: true,
            subscriptionValidatedAt: new Date(),
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // Update subscription usage if exists
        if (order.subscriptionUsage) {
          await tx.subscriptionUsage.update({
            where: { id: order.subscriptionUsage.id },
            data: {
              status: 'VALIDATED',
              validatedAt: new Date(),
              validatedBy: washerProfile.id,
            },
          });
        }

        // Update subscription counters (if not already decremented)
        if (order.subscriptionId) {
          const subscription = await tx.userSubscription.findUnique({
            where: { id: order.subscriptionId },
          });

          if (subscription && subscription.remainingWashes > 0) {
            await tx.userSubscription.update({
              where: { id: order.subscriptionId },
              data: {
                usedWashes: { increment: 1 },
                remainingWashes: { decrement: 1 },
              },
            });
          }
        }

        return updatedOrder;
      });

      return NextResponse.json({
        success: true,
        message: 'Séance validée avec succès',
        order: result,
      });
    }

    if (validationAction === 'REJECT') {
      // Washer rejects - this shouldn't deduct from subscription
      const result = await db.$transaction(async (tx) => {
        // Update order - mark as not subscription order since rejected
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            isSubscriptionOrder: false,
            subscriptionId: null,
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: 'Validation abonnement refusée par le laveur',
          },
        });

        // Cancel subscription usage if exists
        if (order.subscriptionUsage) {
          await tx.subscriptionUsage.update({
            where: { id: order.subscriptionUsage.id },
            data: {
              status: 'CANCELLED',
              adminNotes: 'Refusé par le laveur',
            },
          });
        }

        return updatedOrder;
      });

      return NextResponse.json({
        success: true,
        message: 'Séance refusée',
        order: result,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Validate subscription error:', error);
    return NextResponse.json({ error: 'Erreur lors de la validation' }, { status: 500 });
  }
}

/**
 * PATCH /api/subscriptions/validate
 * Admin override for subscription validation
 * 
 * Body: { usageId: string, action: 'VALIDATE' | 'CANCEL', notes?: string }
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
      const result = await db.$transaction(async (tx) => {
        // Update usage
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
            },
          });
        }

        // Update subscription if not already counted
        if (usage.subscription && usage.subscription.remainingWashes > 0) {
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
        message: 'Utilisation validée par l\'admin',
        usage: result,
      });
    }

    if (action === 'CANCEL') {
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

        // Restore subscription count if it was already decremented
        if (usage.subscription && usage.status === 'VALIDATED') {
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
        message: 'Utilisation annulée par l\'admin',
        usage: result,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Admin validate error:', error);
    return NextResponse.json({ error: 'Erreur lors de la validation' }, { status: 500 });
  }
}
