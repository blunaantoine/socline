import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/seed - Seed database with initial data
export async function POST() {
  try {
    // Check if services already exist
    const existingServices = await db.service.findMany();
    
    let services = existingServices;
    
    if (existingServices.length === 0) {
      // Create default services
      services = await Promise.all([
        db.service.create({
          data: {
            name: 'Lavage Simple',
            description: 'Lavage extérieur complet avec rinçage et séchage',
            price: 2500,
            duration: 20,
            category: 'basic',
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Standard',
            description: 'Lavage extérieur + intérieur, tableau de bord nettoyé',
            price: 4000,
            duration: 35,
            category: 'standard',
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Premium',
            description: 'Lavage complet extérieur + intérieur + aspiration + shampoing sièges',
            price: 6500,
            duration: 50,
            category: 'premium',
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Deluxe',
            description: 'Service VIP: Lavage complet + polish + cire + nettoyant pneus + désodorisant',
            price: 10000,
            duration: 75,
            category: 'deluxe',
            isActive: true,
          },
        }),
      ]);
    }

    // Check if stations exist
    const existingStations = await db.station.count();
    
    let station = null;
    if (existingStations === 0) {
      // Create a default station
      station = await db.station.create({
        data: {
          name: 'Socline Centre-Ville',
          description: 'Station principale Socline au centre-ville de Lomé',
          address: 'Centre-ville, Lomé, Togo',
          latitude: 6.1725,
          longitude: 1.2314,
          phone: '+228 90 00 00 00',
          isActive: true,
        },
      });
    }

    // Create test users if they don't exist
    let clientUser = await db.user.findUnique({ where: { phone: '90123456' } });
    if (!clientUser) {
      clientUser = await db.user.create({
        data: {
          phone: '90123456',
          name: 'Client Test',
          role: 'CLIENT',
          pin: '1234',
          plateNumber: 'TG-1234-A',
          carColor: 'Blanc',
          isActive: true,
        },
      });
    }

    // Create washer user with washer profile
    let washerUser = await db.user.findUnique({ where: { phone: '90234567' } });
    if (!washerUser) {
      washerUser = await db.user.create({
        data: {
          phone: '90234567',
          name: 'Laveur Test',
          role: 'WASHER',
          pin: '1234',
          isActive: true,
        },
      });

      // Create washer profile
      await db.washer.create({
        data: {
          userId: washerUser.id,
          isAvailable: true,
          isVerified: true,
          rating: 0,
          totalRatings: 0,
          totalEarnings: 0,
          completedJobs: 0,
        },
      });
    } else {
      // Check if washer profile exists
      const existingWasher = await db.washer.findUnique({ where: { userId: washerUser.id } });
      if (!existingWasher) {
        await db.washer.create({
          data: {
            userId: washerUser.id,
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

    // Create admin user if doesn't exist
    let adminUser = await db.user.findUnique({ where: { phone: '90345678' } });
    if (!adminUser) {
      adminUser = await db.user.create({
        data: {
          phone: '90345678',
          name: 'Admin Socline',
          role: 'ADMIN',
          pin: '1234',
          isActive: true,
        },
      });
    }

    // Create default promotion if doesn't exist
    const existingPromotions = await db.promotion.count();
    if (existingPromotions === 0) {
      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // 3 months from now

      await db.promotion.create({
        data: {
          name: 'sur votre 1er lavage',
          description: 'Profitez de 20% de réduction sur votre premier lavage auto avec Socline',
          type: 'GLOBAL',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          code: 'WELCOME20',
          startDate: now,
          endDate: endDate,
          maxUses: 1000,
          maxUsesPerUser: 1,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      services,
      station,
      testUsers: {
        client: { phone: '90123456', pin: '1234', role: 'CLIENT' },
        washer: { phone: '90234567', pin: '1234', role: 'WASHER' },
        admin: { phone: '90345678', pin: '1234', role: 'ADMIN' },
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'initialisation' }, { status: 500 });
  }
}

// GET /api/seed - Check if database is seeded
export async function GET() {
  try {
    const servicesCount = await db.service.count();
    const stationsCount = await db.station.count();
    const usersCount = await db.user.count();
    const washersCount = await db.washer.count();
    
    return NextResponse.json({ 
      seeded: servicesCount > 0,
      servicesCount,
      stationsCount,
      usersCount,
      washersCount
    });
  } catch (error) {
    console.error('Check seed error:', error);
    return NextResponse.json({ error: 'Erreur de vérification' }, { status: 500 });
  }
}
