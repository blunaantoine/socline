import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/subscriptions/plans - Get all subscription plans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const plans = await db.subscriptionPlan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            // Exposed so the client can show the difference between
            // "Extérieur seul" and "Complet (extérieur + intérieur)" plans.
            coverage: true,
            category: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({
      success: true,
      plans: plans.map(plan => ({
        ...plan,
        features: plan.features ? JSON.parse(plan.features) : [],
      })),
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/subscriptions/plans - Create a subscription plan (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      displayName,
      description,
      price,
      quarterlyPrice,
      yearlyPrice,
      washCount,
      serviceId,
      priority,
      bonusWashes,
      freeOptions,
      includesExpress,
      includesVip,
      features,
      displayOrder,
    } = body;

    if (!name || !displayName || !price || !serviceId) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    // Check if service exists
    const service = await db.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service non trouvé' }, { status: 400 });
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description,
        price,
        quarterlyPrice,
        yearlyPrice,
        washCount: washCount || 4,
        serviceId,
        priority: priority || 0,
        bonusWashes: bonusWashes || 0,
        freeOptions: freeOptions || 0,
        includesExpress: includesExpress || false,
        includesVip: includesVip || false,
        features: features ? JSON.stringify(features) : null,
        displayOrder: displayOrder || 0,
      },
      include: {
        service: true,
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

// PATCH /api/subscriptions/plans - Update a subscription plan (admin)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, ...updateData } = body;

    if (!planId) {
      return NextResponse.json({ error: 'ID du plan requis' }, { status: 400 });
    }

    // Handle features serialization
    if (updateData.features) {
      updateData.features = JSON.stringify(updateData.features);
    }

    const plan = await db.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
      include: {
        service: true,
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
