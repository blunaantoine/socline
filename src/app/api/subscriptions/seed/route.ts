import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/subscriptions/seed - Seed subscription plans
export async function POST() {
  try {
    // Get existing services
    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    if (services.length === 0) {
      return NextResponse.json({ error: 'Aucun service trouvé. Créez d\'abord les services.' }, { status: 400 });
    }

    // Map services by name
    const serviceMap: Record<string, typeof services[0]> = {};
    for (const service of services) {
      serviceMap[service.name.toLowerCase()] = service;
      if (service.name.includes('Essentiel')) serviceMap['essentiel'] = service;
      if (service.name.includes('Confort')) serviceMap['confort'] = service;
      if (service.name.includes('Premium')) serviceMap['premium'] = service;
      if (service.name.includes('Prestige')) serviceMap['prestige'] = service;
    }

    // Define subscription plans
    const plans = [
      {
        name: 'Essentiel',
        displayName: 'Abonnement Essentiel',
        description: '4 lavages Essentiel par mois',
        price: 8000,
        quarterlyPrice: 21600, // 10% reduction
        yearlyPrice: 76800, // 20% reduction
        washCount: 4,
        serviceId: serviceMap['essentiel']?.id || services[0]?.id,
        priority: 0,
        bonusWashes: 0,
        freeOptions: 0,
        includesExpress: false,
        includesVip: false,
        features: [
          'Économie par rapport au paiement à l\'unité',
          'Accès rapide au service',
        ],
        displayOrder: 1,
      },
      {
        name: 'Confort',
        displayName: 'Abonnement Confort',
        description: '4 lavages Confort par mois + 1 désodorisation offerte',
        price: 14000,
        quarterlyPrice: 37800,
        yearlyPrice: 134400,
        washCount: 4,
        serviceId: serviceMap['confort']?.id || services[1]?.id || services[0]?.id,
        priority: 1,
        bonusWashes: 0,
        freeOptions: 1, // 1 désodorisation
        includesExpress: false,
        includesVip: false,
        features: [
          'Économie mensuelle',
          'Priorité légère sur les réservations',
          '1 désodorisation offerte par mois',
        ],
        displayOrder: 2,
      },
      {
        name: 'Premium',
        displayName: 'Abonnement Premium',
        description: '4 lavages Premium par mois + 2 options offertes',
        price: 22000,
        quarterlyPrice: 59400,
        yearlyPrice: 211200,
        washCount: 4,
        serviceId: serviceMap['premium']?.id || services[2]?.id || services[0]?.id,
        priority: 2,
        bonusWashes: 0,
        freeOptions: 2, // 2 options au choix
        includesExpress: true,
        includesVip: false,
        features: [
          'Priorité sur les réservations',
          '2 options offertes (désodorisation, nettoyage vitres)',
          'Accès à un service plus rapide',
        ],
        displayOrder: 3,
      },
      {
        name: 'Prestige',
        displayName: 'Abonnement Prestige',
        description: '4 lavages Prestige par mois + Accès VIP',
        price: 34000,
        quarterlyPrice: 91800,
        yearlyPrice: 326400,
        washCount: 4,
        serviceId: serviceMap['prestige']?.id || services[3]?.id || services[0]?.id,
        priority: 3,
        bonusWashes: 1, // 1 lavage bonus si tous utilisés
        freeOptions: 0,
        includesExpress: true,
        includesVip: true,
        features: [
          'Priorité maximale',
          'Service express inclus',
          '1 lavage supplémentaire offert si tous les lavages sont utilisés',
          'Accès VIP',
        ],
        displayOrder: 4,
      },
    ];

    // Create or update plans
    const results = [];
    for (const planData of plans) {
      if (!planData.serviceId) continue;

      const existing = await db.subscriptionPlan.findUnique({
        where: { name: planData.name },
      });

      if (existing) {
        const updated = await db.subscriptionPlan.update({
          where: { id: existing.id },
          data: {
            ...planData,
            features: JSON.stringify(planData.features),
          },
        });
        results.push(updated);
      } else {
        const created = await db.subscriptionPlan.create({
          data: {
            ...planData,
            features: JSON.stringify(planData.features),
          },
        });
        results.push(created);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} plans d'abonnement créés/mis à jour`,
      plans: results,
    });
  } catch (error) {
    console.error('Seed subscription plans error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'initialisation' }, { status: 500 });
  }
}
