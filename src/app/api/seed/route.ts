import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/seed - Seed database with initial data
export async function POST() {
  try {
    // Check if services already exist
    const existingServices = await db.service.findMany();
    
    let services = existingServices;
    
    if (existingServices.length === 0) {
      // Create default services with detailed descriptions
      services = await Promise.all([
        db.service.create({
          data: {
            name: 'Lavage Essentiel',
            description: 'Ce service assure un entretien rapide et efficace de l\'extérieur du véhicule. Il permet d\'éliminer les saletés superficielles telles que la poussière et la boue, tout en redonnant un aspect propre et soigné à la carrosserie grâce à un séchage manuel sans traces.',
            price: 2500,
            duration: 20,
            category: 'essentiel',
            products: JSON.stringify([
              'Shampoing automobile au pH neutre respectueux de la peinture',
              'Eau sous pression pour un rinçage efficace',
              'Microfibres douces pour un séchage sans rayures'
            ]),
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Confort',
            description: 'Ce service propose un nettoyage complet de l\'extérieur et un entretien de base de l\'intérieur. En plus du lavage extérieur, les surfaces intérieures visibles sont nettoyées afin d\'améliorer l\'hygiène et le confort à bord.',
            price: 4000,
            duration: 35,
            category: 'confort',
            products: JSON.stringify([
              'Shampoing automobile au pH neutre',
              'Nettoyant multi-surfaces pour plastiques et tableau de bord',
              'Nettoyant vitres sans traces pour une visibilité optimale',
              'Microfibres professionnelles adaptées aux surfaces intérieures'
            ]),
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Premium',
            description: 'Ce service offre un nettoyage approfondi du véhicule avec une attention particulière portée à l\'intérieur. Il comprend une aspiration complète et un traitement des sièges pour éliminer les saletés incrustées et améliorer la qualité de l\'air à bord.',
            price: 6500,
            duration: 50,
            category: 'premium',
            products: JSON.stringify([
              'Shampoing automobile haute qualité',
              'Nettoyant spécifique textile ou cuir selon les sièges',
              'Aspirateur professionnel haute puissance',
              'Nettoyant intérieur renforcé pour un nettoyage en profondeur',
              'Produits hygiénisants pour assainir l\'habitacle'
            ]),
            isActive: true,
          },
        }),
        db.service.create({
          data: {
            name: 'Lavage Prestige',
            description: 'Ce service représente le niveau le plus élevé de finition. Il inclut un traitement esthétique complet du véhicule avec des produits haut de gamme visant à restaurer l\'éclat de la carrosserie et à protéger durablement les surfaces.',
            price: 10000,
            duration: 75,
            category: 'prestige',
            products: JSON.stringify([
              'Shampoing automobile premium',
              'Polish rénovateur pour raviver la peinture',
              'Cire protectrice pour prolonger la brillance',
              'Nettoyant et brillant pour pneus',
              'Produits spécialisés pour plastiques et surfaces sensibles',
              'Désodorisant longue durée pour un intérieur agréable'
            ]),
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

      await Promise.all([
        db.promotion.create({
          data: {
            name: 'sur votre 1er lavage',
            description: 'Profitez de 20% de réduction sur votre premier lavage auto avec Socline',
            type: 'GLOBAL',
            discountType: 'PERCENTAGE',
            discountValue: 20,
            code: 'WELCOME20',
            displayType: 'TEXT',
            startDate: now,
            endDate: endDate,
            maxUses: 1000,
            maxUsesPerUser: 1,
            isActive: true,
          },
        }),
        db.promotion.create({
          data: {
            name: 'Weekend Special',
            description: '15% de réduction sur tous les lavages ce weekend',
            type: 'GLOBAL',
            discountType: 'PERCENTAGE',
            discountValue: 15,
            code: 'WEEKEND15',
            displayType: 'TEXT',
            startDate: now,
            endDate: endDate,
            maxUses: 500,
            maxUsesPerUser: 5,
            isActive: true,
          },
        }),
        db.promotion.create({
          data: {
            name: 'Parrainage',
            description: 'Invitez un ami et recevez 1000F de réduction',
            type: 'GLOBAL',
            discountType: 'FIXED',
            discountValue: 1000,
            code: 'PARRAIN1K',
            displayType: 'TEXT',
            startDate: now,
            endDate: endDate,
            maxUses: null,
            maxUsesPerUser: 10,
            isActive: true,
          },
        }),
      ]);
    }

    // Create Mobile Money operators if they don't exist
    const existingOperators = await db.mobileMoneyOperator.count();
    if (existingOperators === 0) {
      // Mixx by Yas (Togo Telecom)
      await db.mobileMoneyOperator.create({
        data: {
          name: 'Mixx by Yas',
          displayName: 'Mixx by Yas (Togo Telecom)',
          ussdPattern: '*145*1*{montant}*{numero}*2#',
          recipientNumber: '90000000',
          color: '#0066CC',
          minAmount: 100,
          maxAmount: 500000,
          isActive: true,
        },
      });

      // Flooz (Moov Africa)
      await db.mobileMoneyOperator.create({
        data: {
          name: 'Flooz',
          displayName: 'Flooz (Moov Africa)',
          ussdPattern: '*155*1*{montant}*{numero}*2#',
          recipientNumber: '95000000',
          color: '#E60000',
          minAmount: 100,
          maxAmount: 500000,
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
