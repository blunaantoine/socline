import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/washers - Get all washers
export async function GET(request: NextRequest) {
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
          _sum: { totalPrice: true },
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
          earnings: (earnings._sum.totalPrice || 0) - (earnings._sum.totalPrice || 0) * 0.15, // After commission
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
