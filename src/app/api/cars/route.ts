import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/cars - Get all cars for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    const cars = await db.car.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      cars,
      count: cars.length,
      maxCars: 10,
      canAddMore: cars.length < 10,
    });
  } catch (error) {
    console.error('Get cars error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/cars - Add a new car
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, nickname, plateNumber, brand, model, color, year, isDefault } = body;

    if (!userId || !plateNumber || !color) {
      return NextResponse.json({ 
        error: 'Veuillez remplir les champs obligatoires (plaque, couleur)' 
      }, { status: 400 });
    }

    // Check if user has reached the limit
    const existingCars = await db.car.count({
      where: { userId },
    });

    if (existingCars >= 10) {
      return NextResponse.json({ 
        error: 'Vous avez atteint la limite de 10 voitures' 
      }, { status: 400 });
    }

    // If this is the first car, make it default
    const isFirstCar = existingCars === 0;

    // If setting as default, unset other defaults
    if (isDefault || isFirstCar) {
      await db.car.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Validate plate number format (basic validation for Togo plates)
    const plateRegex = /^[A-Z]{2,3}-?\d{3,4}-?[A-Z]?$/i;
    const formattedPlate = plateNumber.toUpperCase().replace(/\s+/g, '');

    const car = await db.car.create({
      data: {
        userId,
        nickname: nickname || null,
        plateNumber: formattedPlate,
        brand: brand || null,
        model: model || null,
        color,
        year: year ? parseInt(year) : null,
        isDefault: isDefault || isFirstCar,
      },
    });

    return NextResponse.json({
      success: true,
      car,
      message: 'Véhicule ajouté avec succès',
    });
  } catch (error) {
    console.error('Add car error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'ajout du véhicule' }, { status: 500 });
  }
}

// PUT /api/cars - Update a car
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { carId, userId, nickname, plateNumber, brand, model, color, year, isDefault } = body;

    if (!carId || !userId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Verify car belongs to user
    const existingCar = await db.car.findFirst({
      where: { id: carId, userId },
    });

    if (!existingCar) {
      return NextResponse.json({ error: 'Véhicule non trouvé' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.car.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (nickname !== undefined) updateData.nickname = nickname || null;
    if (plateNumber) updateData.plateNumber = plateNumber.toUpperCase().replace(/\s+/g, '');
    if (brand !== undefined) updateData.brand = brand || null;
    if (model !== undefined) updateData.model = model || null;
    if (color) updateData.color = color;
    if (year !== undefined) updateData.year = year ? parseInt(year) : null;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const car = await db.car.update({
      where: { id: carId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      car,
      message: 'Véhicule mis à jour',
    });
  } catch (error) {
    console.error('Update car error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

// DELETE /api/cars - Delete a car
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const carId = searchParams.get('carId');
    const userId = searchParams.get('userId');

    if (!carId || !userId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Verify car belongs to user
    const car = await db.car.findFirst({
      where: { id: carId, userId },
    });

    if (!car) {
      return NextResponse.json({ error: 'Véhicule non trouvé' }, { status: 404 });
    }

    const wasDefault = car.isDefault;

    // Delete the car
    await db.car.delete({
      where: { id: carId },
    });

    // If it was the default car, set another as default
    if (wasDefault) {
      const nextCar = await db.car.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextCar) {
        await db.car.update({
          where: { id: nextCar.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Véhicule supprimé',
    });
  } catch (error) {
    console.error('Delete car error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
