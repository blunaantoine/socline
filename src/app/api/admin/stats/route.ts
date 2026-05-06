import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  // Check admin authorization
  const { authorized, response } = await requireAdmin(request);
  if (!authorized) return response;

  try {
    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get counts
    const [
      totalOrders,
      todayOrders,
      totalUsers,
      totalWashers,
      activeWashers,
      totalServices,
      totalRevenue,
      todayRevenue,
      monthRevenue,
      pendingOrders,
      inProgressOrders,
      completedOrders,
    ] = await Promise.all([
      // Total orders
      db.order.count(),
      
      // Today's orders
      db.order.count({
        where: { createdAt: { gte: today } },
      }),
      
      // Total users (clients)
      db.user.count({ where: { role: 'CLIENT' } }),
      
      // Total washers
      db.washer.count(),
      
      // Active washers (verified and available)
      db.washer.count({ where: { isAvailable: true, isVerified: true } }),
      
      // Total services
      db.service.count({ where: { isActive: true } }),
      
      // Total revenue (completed orders)
      db.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalPrice: true },
      }),
      
      // Today's revenue
      db.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: today } },
        _sum: { totalPrice: true },
      }),
      
      // Month revenue
      db.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: thisMonthStart } },
        _sum: { totalPrice: true },
      }),
      
      // Pending orders
      db.order.count({ where: { status: 'PENDING' } }),
      
      // In progress orders
      db.order.count({ where: { status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } } }),
      
      // Completed orders
      db.order.count({ where: { status: 'COMPLETED' } }),
    ]);

    // Get revenue by day for last 7 days
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const revenue = await db.order.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: date, lt: nextDate },
        },
        _sum: { totalPrice: true },
      });
      
      revenueByDay.push({
        day: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        revenue: revenue._sum.totalPrice || 0,
      });
    }

    // Get orders by service
    const ordersByService = await db.order.groupBy({
      by: ['serviceId'],
      _count: { id: true },
      where: { status: 'COMPLETED' },
    });

    const servicesWithCount = await Promise.all(
      ordersByService.map(async (item) => {
        const service = await db.service.findUnique({
          where: { id: item.serviceId },
          select: { name: true },
        });
        return {
          name: service?.name || 'Unknown',
          count: item._count.id,
        };
      })
    );

    // Get recent orders
    const recentOrders = await db.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { name: true } },
        service: { select: { name: true } },
        washer: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalOrders,
        todayOrders,
        totalUsers,
        totalWashers,
        activeWashers,
        totalServices,
        totalRevenue: totalRevenue._sum.totalPrice || 0,
        todayRevenue: todayRevenue._sum.totalPrice || 0,
        monthRevenue: monthRevenue._sum.totalPrice || 0,
        pendingOrders,
        inProgressOrders,
        completedOrders,
      },
      charts: {
        revenueByDay,
        ordersByService: servicesWithCount,
      },
      recentOrders: recentOrders.map(o => ({
        id: o.orderNumber,
        client: o.client?.name || 'N/A',
        service: o.service?.name || 'N/A',
        amount: o.totalPrice,
        status: o.status,
        time: o.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })),
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
