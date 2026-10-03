import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPin, requireAdmin } from '@/lib/auth';

// POST /api/admin/washers - Create a new washer
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { name, phone, email, pin, isVerified, userId } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Le téléphone est requis' }, { status: 400 });
    }

    // Validate optional PIN format (4 digits) if provided
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Le PIN doit contenir exactement 4 chiffres' }, { status: 400 });
    }

    // Check if user already exists
    let user = await db.user.findUnique({
      where: { phone },
    });

    if (user) {
      // User exists, check if already a washer
      const existingWasher = await db.washer.findUnique({
        where: { userId: user.id },
      });

      if (existingWasher) {
        return NextResponse.json({ error: 'Cet utilisateur est déjà un laveur' }, { status: 400 });
      }

      // Update user role to WASHER
      user = await db.user.update({
        where: { id: user.id },
        data: {
          role: 'WASHER',
          name: name || user.name,
        },
      });
    } else {
      // Create new user with WASHER role
      // SECURITY: the PIN must always be stored hashed (bcrypt), never in
      // plaintext — a plaintext default ('1234') would be readable by anyone
      // with database access.
      user = await db.user.create({
        data: {
          phone,
          name: name || null,
          email: email || null,
          pin: await hashPin(pin || '1234'),
          role: 'WASHER',
          isActive: true,
        },
      });
    }

    // Create washer profile
    const washer = await db.washer.create({
      data: {
        userId: user.id,
        isAvailable: true,
        isVerified: isVerified !== undefined ? isVerified : true, // Auto-verify by default
        rating: 0,
        totalRatings: 0,
        totalEarnings: 0,
        completedJobs: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      washer: {
        id: washer.id,
        name: washer.user.name,
        phone: washer.user.phone,
        email: washer.user.email,
        isVerified: washer.isVerified,
        isAvailable: washer.isAvailable,
      },
    });
  } catch (error) {
    console.error('Create washer error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

// GET /api/admin/washers - Get all washers
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // 'pending', 'verified', 'all'

    const where = {
      ...(search && {
        user: {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        },
      }),
      ...(status === 'pending' && { isVerified: false }),
      ...(status === 'verified' && { isVerified: true }),
    };

    const washers = await db.washer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get order counts for each washer
    const washersWithOrders = await Promise.all(
      washers.map(async (washer) => {
        const completedOrders = await db.order.count({
          where: { washerId: washer.id, status: 'COMPLETED' },
        });

        const earnings = await db.order.aggregate({
          where: { washerId: washer.id, status: 'COMPLETED' },
          _sum: { totalPrice: true, commission: true },
        });

        return {
          id: washer.id,
          userId: washer.userId,
          name: washer.user.name || 'N/A',
          phone: washer.user.phone,
          email: washer.user.email || '',
          rating: washer.rating,
          totalRatings: washer.totalRatings,
          completedJobs: completedOrders,
          // Partner share = total collected - commissions actually applied
          // per order (Contrat Article 5: commission depends on washer level)
          earnings: (earnings._sum.totalPrice || 0) - (earnings._sum.commission || 0),
          isAvailable: washer.isAvailable,
          isVerified: washer.isVerified,
          createdAt: washer.user.createdAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      washers: washersWithOrders,
    });
  } catch (error) {
    console.error('Get washers error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/washers - Update washer (verify, etc.)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) {
    return auth.response!;
  }
  try {
    const body = await request.json();
    const { washerId, action } = body; // action: 'verify', 'reject', 'suspend'

    if (!washerId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    let updateData: any = {};

    switch (action) {
      case 'verify':
        updateData.isVerified = true;
        break;
      case 'reject':
      case 'suspend':
        // For reject/suspend, we would need to delete or deactivate
        // For now, just mark as not verified
        updateData.isVerified = false;
        break;
      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    const washer = await db.washer.update({
      where: { id: washerId },
      data: updateData,
      include: {
        user: { select: { name: true, phone: true } },
      },
    });

    return NextResponse.json({ success: true, washer });
  } catch (error) {
    console.error('Update washer error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
