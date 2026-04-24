import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all subscription plans
export async function GET(request: NextRequest) {
  try {
    const plans = await db.subscriptionPlan.findMany({
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          }
        },
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    return NextResponse.json({ 
      success: true, 
      plans: plans.map(plan => ({
        ...plan,
        subscribersCount: plan._count.subscriptions
      }))
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement' },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription plan
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
      isActive,
      displayOrder,
    } = body;

    // Validate required fields
    if (!name || !displayName || !price || !washCount || !serviceId) {
      return NextResponse.json(
        { success: false, error: 'Veuillez remplir tous les champs obligatoires' },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { name }
    });

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Un forfait avec ce nom existe déjà' },
        { status: 400 }
      );
    }

    // Verify service exists
    const service = await db.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service non trouvé' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description: description || null,
        price: parseFloat(price),
        quarterlyPrice: quarterlyPrice ? parseFloat(quarterlyPrice) : null,
        yearlyPrice: yearlyPrice ? parseFloat(yearlyPrice) : null,
        washCount: parseInt(washCount),
        serviceId,
        priority: priority || 0,
        bonusWashes: bonusWashes || 0,
        freeOptions: freeOptions || 0,
        includesExpress: includesExpress || false,
        includesVip: includesVip || false,
        features: features ? JSON.stringify(features) : null,
        isActive: isActive !== undefined ? isActive : true,
        displayOrder: displayOrder || 0,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      plan,
      message: 'Forfait créé avec succès'
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}

// PUT - Update a subscription plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID du forfait requis' },
        { status: 400 }
      );
    }

    // Check if plan exists
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Forfait non trouvé' },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (updateData.name && updateData.name !== existingPlan.name) {
      const duplicateName = await db.subscriptionPlan.findUnique({
        where: { name: updateData.name }
      });
      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: 'Un forfait avec ce nom existe déjà' },
          { status: 400 }
        );
      }
    }

    // If serviceId is being changed, verify service exists
    if (updateData.serviceId) {
      const service = await db.service.findUnique({
        where: { id: updateData.serviceId }
      });
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'Service non trouvé' },
          { status: 400 }
        );
      }
    }

    // Prepare update data with proper types
    const dataToUpdate: any = {};
    
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
    if (updateData.displayName !== undefined) dataToUpdate.displayName = updateData.displayName;
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description || null;
    if (updateData.price !== undefined) dataToUpdate.price = parseFloat(updateData.price);
    if (updateData.quarterlyPrice !== undefined) dataToUpdate.quarterlyPrice = updateData.quarterlyPrice ? parseFloat(updateData.quarterlyPrice) : null;
    if (updateData.yearlyPrice !== undefined) dataToUpdate.yearlyPrice = updateData.yearlyPrice ? parseFloat(updateData.yearlyPrice) : null;
    if (updateData.washCount !== undefined) dataToUpdate.washCount = parseInt(updateData.washCount);
    if (updateData.serviceId !== undefined) dataToUpdate.serviceId = updateData.serviceId;
    if (updateData.priority !== undefined) dataToUpdate.priority = updateData.priority;
    if (updateData.bonusWashes !== undefined) dataToUpdate.bonusWashes = updateData.bonusWashes;
    if (updateData.freeOptions !== undefined) dataToUpdate.freeOptions = updateData.freeOptions;
    if (updateData.includesExpress !== undefined) dataToUpdate.includesExpress = updateData.includesExpress;
    if (updateData.includesVip !== undefined) dataToUpdate.includesVip = updateData.includesVip;
    if (updateData.features !== undefined) dataToUpdate.features = updateData.features ? JSON.stringify(updateData.features) : null;
    if (updateData.isActive !== undefined) dataToUpdate.isActive = updateData.isActive;
    if (updateData.displayOrder !== undefined) dataToUpdate.displayOrder = updateData.displayOrder;

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: dataToUpdate,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      plan,
      message: 'Forfait mis à jour avec succès'
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a subscription plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID du forfait requis' },
        { status: 400 }
      );
    }

    // Check if plan exists and has subscriptions
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Forfait non trouvé' },
        { status: 404 }
      );
    }

    if (existingPlan._count.subscriptions > 0) {
      return NextResponse.json(
        { success: false, error: `Ce forfait a ${existingPlan._count.subscriptions} abonnement(s) actif(s). Veuillez d'abord les supprimer ou les transférer.` },
        { status: 400 }
      );
    }

    await db.subscriptionPlan.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Forfait supprimé avec succès'
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
