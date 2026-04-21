import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all promotions or active promotions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    
    const where: any = {};
    
    if (activeOnly) {
      const now = new Date();
      where.isActive = true;
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }
    
    const promotions = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      promotions,
    });
  } catch (error) {
    console.error('Fetch promotions error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des promotions' },
      { status: 500 }
    );
  }
}

// POST - Create a new promotion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      type = 'GLOBAL',
      discountType = 'PERCENTAGE',
      discountValue,
      code,
      displayType = 'TEXT',
      image,
      startDate,
      endDate,
      maxUses,
      maxUsesPerUser = 1,
      minOrderAmount,
      isActive = true,
    } = body;
    
    // Validate required fields
    if (!name || !discountValue || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Veuillez remplir tous les champs obligatoires' },
        { status: 400 }
      );
    }
    
    const promotion = await db.promotion.create({
      data: {
        name,
        description,
        type,
        discountType,
        discountValue: parseFloat(discountValue),
        code: code?.toUpperCase() || null,
        displayType: displayType || 'TEXT',
        image: displayType === 'IMAGE' ? (image || null) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerUser: parseInt(maxUsesPerUser),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        isActive,
      },
    });
    
    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Create promotion error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la promotion' },
      { status: 500 }
    );
  }
}

// PUT - Update a promotion
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de promotion requis' },
        { status: 400 }
      );
    }
    
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type) updateData.type = data.type;
    if (data.discountType) updateData.discountType = data.discountType;
    if (data.discountValue) updateData.discountValue = parseFloat(data.discountValue);
    if (data.code !== undefined) updateData.code = data.code?.toUpperCase() || null;
    if (data.displayType) {
      updateData.displayType = data.displayType;
      // Only save image if displayType is IMAGE
      updateData.image = data.displayType === 'IMAGE' ? (data.image || null) : null;
    }
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses ? parseInt(data.maxUses) : null;
    if (data.maxUsesPerUser) updateData.maxUsesPerUser = parseInt(data.maxUsesPerUser);
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount ? parseFloat(data.minOrderAmount) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const promotion = await db.promotion.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({
      success: true,
      promotion,
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la promotion' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a promotion
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de promotion requis' },
        { status: 400 }
      );
    }
    
    await db.promotion.delete({
      where: { id },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Promotion supprimée',
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la promotion' },
      { status: 500 }
    );
  }
}
