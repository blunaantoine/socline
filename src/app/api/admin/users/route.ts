import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/users - Create a new user (client or washer)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, role, pin, createWasher } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Le téléphone est requis' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Un utilisateur avec ce numéro existe déjà' }, { status: 400 });
    }

    // Create user
    const user = await db.user.create({
      data: {
        phone,
        name: name || null,
        email: email || null,
        pin: pin || '1234',
        role: role || 'CLIENT',
        isActive: true,
      },
    });

    // If createWasher is true, also create washer profile
    if (createWasher || role === 'WASHER') {
      await db.washer.create({
        data: {
          userId: user.id,
          isAvailable: true,
          isVerified: true, // Auto-verify admin-created washers
          rating: 0,
          totalRatings: 0,
          totalEarnings: 0,
          completedJobs: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

// PATCH /api/admin/users - Update user status or role
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, isActive, role, name, pin } = body;

    if (!userId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (pin !== undefined) updateData.pin = pin;

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // If promoting to washer, create washer profile if not exists
    if (role === 'WASHER') {
      const existingWasher = await db.washer.findUnique({
        where: { userId: user.id },
      });

      if (!existingWasher) {
        await db.washer.create({
          data: {
            userId: user.id,
            isAvailable: true,
            isVerified: true,
            rating: 0,
            totalRatings: 0,
            totalEarnings: 0,
            completedJobs: 0,
          },
        });
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

// DELETE /api/admin/users - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    // Check if user has orders
    const orderCount = await db.order.count({
      where: { clientId: userId },
    });

    if (orderCount > 0) {
      return NextResponse.json({ 
        error: 'Impossible de supprimer un utilisateur avec des commandes' 
      }, { status: 400 });
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}

// GET /api/admin/users - Get all users (clients)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = {
      role: 'CLIENT' as const,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
          plateNumber: true,
          carColor: true,
          _count: {
            select: { clientOrders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        name: u.name || 'N/A',
        phone: u.phone,
        email: u.email || '',
        orders: u._count.clientOrders,
        status: u.isActive ? 'active' : 'inactive',
        plateNumber: u.plateNumber,
        carColor: u.carColor,
        createdAt: u.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
