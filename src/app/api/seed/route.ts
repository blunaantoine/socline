import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/seed - Seed database with initial data
export async function POST() {
  try {
    // Check if services already exist
    const existingServices = await db.service.findMany();
    
    if (existingServices.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Database already seeded',
        services: existingServices 
      });
    }

    // Create default services
    const services = await Promise.all([
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

    // Create a default station
    const station = await db.station.create({
      data: {
        name: 'WashGo Centre-Ville',
        description: 'Station principale WashGo au centre-ville de Lomé',
        address: 'Centre-ville, Lomé, Togo',
        latitude: 6.1725,
        longitude: 1.2314,
        phone: '+228 90 00 00 00',
        isActive: true,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      services,
      station
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
    
    return NextResponse.json({ 
      seeded: servicesCount > 0,
      servicesCount,
      stationsCount
    });
  } catch (error) {
    console.error('Check seed error:', error);
    return NextResponse.json({ error: 'Erreur de vérification' }, { status: 500 });
  }
}
