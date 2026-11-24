import { db } from '@/lib/db';
import {
  currentPeriod,
  getActiveContract,
  isValidTogoPhone,
  linkVehicleIfDriverExists,
  makeInvoiceNumber,
  normalizePhone,
  periodBounds,
  unlinkFleetVehicle,
} from '@/lib/company';

/**
 * Opérations de l'offre Socline Entreprises, partagées par l'admin
 * (/api/admin/companies/*) et l'espace gestionnaire (/api/company/*).
 * Chaque fonction lève une ServiceError (message affichable) en cas de refus.
 */
export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface VehicleInput {
  plateNumber?: string;
  brand?: string | null;
  model?: string | null;
  color?: string;
  driverName?: string | null;
  driverPhone?: string;
  isActive?: boolean;
}

function cleanPlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/\s+/g, ' ');
}

export async function createVehicle(companyId: string, input: VehicleInput) {
  const plateNumber = cleanPlate(input.plateNumber || '');
  const color = (input.color || '').trim();
  const driverPhone = normalizePhone(input.driverPhone || '');
  if (!plateNumber) throw new ServiceError('La plaque est requise');
  if (!color) throw new ServiceError('La couleur est requise');
  if (!isValidTogoPhone(driverPhone)) {
    throw new ServiceError('Numéro du conducteur invalide (8 chiffres commençant par 7 ou 9)');
  }

  const contract = await getActiveContract(companyId);
  const activeCount = await db.fleetVehicle.count({ where: { companyId, isActive: true } });
  if (contract && activeCount >= contract.maxVehicles) {
    throw new ServiceError(
      `Le contrat couvre ${contract.maxVehicles} voiture(s) au maximum. Contactez Socline pour l'étendre.`
    );
  }
  const duplicate = await db.fleetVehicle.findFirst({ where: { companyId, plateNumber, isActive: true } });
  if (duplicate) throw new ServiceError('Cette plaque est déjà enregistrée pour votre entreprise');

  const vehicle = await db.fleetVehicle.create({
    data: {
      companyId,
      plateNumber,
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      color,
      driverName: input.driverName?.trim() || null,
      driverPhone,
    },
  });
  await linkVehicleIfDriverExists(driverPhone);
  return db.fleetVehicle.findUnique({ where: { id: vehicle.id } });
}

export async function updateVehicle(companyId: string, vehicleId: string, input: VehicleInput) {
  const vehicle = await db.fleetVehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new ServiceError('Véhicule introuvable', 404);

  const data: Record<string, unknown> = {};
  if (input.plateNumber !== undefined) {
    const plate = cleanPlate(input.plateNumber);
    if (!plate) throw new ServiceError('La plaque est requise');
    data.plateNumber = plate;
  }
  if (input.color !== undefined) {
    if (!input.color.trim()) throw new ServiceError('La couleur est requise');
    data.color = input.color.trim();
  }
  if (input.brand !== undefined) data.brand = input.brand?.trim() || null;
  if (input.model !== undefined) data.model = input.model?.trim() || null;
  if (input.driverName !== undefined) data.driverName = input.driverName?.trim() || null;

  let driverChanged = false;
  if (input.driverPhone !== undefined) {
    const phone = normalizePhone(input.driverPhone);
    if (!isValidTogoPhone(phone)) {
      throw new ServiceError('Numéro du conducteur invalide (8 chiffres commençant par 7 ou 9)');
    }
    driverChanged = phone !== vehicle.driverPhone;
    data.driverPhone = phone;
  }

  let reactivated = false;
  if (input.isActive !== undefined && input.isActive !== vehicle.isActive) {
    if (input.isActive) {
      const contract = await getActiveContract(companyId);
      const activeCount = await db.fleetVehicle.count({ where: { companyId, isActive: true } });
      if (contract && activeCount >= contract.maxVehicles) {
        throw new ServiceError(`Le contrat couvre ${contract.maxVehicles} voiture(s) au maximum.`);
      }
      reactivated = true;
    }
    data.isActive = input.isActive;
  }

  // Nouveau conducteur ou voiture retirée : elle quitte le compte de l'ancien.
  if (driverChanged || input.isActive === false) {
    await unlinkFleetVehicle(vehicle.id);
  }
  const updated = await db.fleetVehicle.update({ where: { id: vehicle.id }, data });

  // Garde la fiche « Car » du conducteur alignée (plaque, couleur…).
  if (updated.carId && !driverChanged) {
    await db.car.update({
      where: { id: updated.carId },
      data: { plateNumber: updated.plateNumber, brand: updated.brand, model: updated.model, color: updated.color },
    }).catch(() => {});
  }
  if ((driverChanged || reactivated) && updated.isActive) {
    await linkVehicleIfDriverExists(updated.driverPhone);
  }
  return db.fleetVehicle.findUnique({ where: { id: vehicle.id } });
}

/** Véhicules avec quota du mois et état du compte conducteur. */
export async function listVehicles(companyId: string, period = currentPeriod()) {
  const { start, end } = periodBounds(period);
  const [vehicles, contract, counts] = await Promise.all([
    db.fleetVehicle.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    }),
    getActiveContract(companyId),
    db.order.groupBy({
      by: ['fleetVehicleId'],
      where: {
        companyId,
        isCompanyOrder: true,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lt: end },
      },
      _count: { _all: true },
    }),
  ]);
  const used = new Map(counts.map((c) => [c.fleetVehicleId, c._count._all]));
  const included = contract?.washesPerVehicle ?? 0;
  return vehicles.map((v) => {
    const u = used.get(v.id) ?? 0;
    return {
      ...v,
      driverStatus: v.carId ? 'ACTIVE' : 'INVITED',
      washesUsed: u,
      washesIncluded: included,
      washesRemaining: Math.max(0, included - u),
    };
  });
}

/** Lavages de l'entreprise (filtrables par mois et par voiture). */
export async function listCompanyOrders(
  companyId: string,
  opts: { period?: string; vehicleId?: string; take?: number } = {}
) {
  const where: Record<string, unknown> = { companyId, isCompanyOrder: true };
  if (opts.period) {
    const { start, end } = periodBounds(opts.period);
    where.createdAt = { gte: start, lt: end };
  }
  if (opts.vehicleId) where.fleetVehicleId = opts.vehicleId;
  return db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.take ?? 200, 500),
    select: {
      id: true,
      orderNumber: true,
      status: true,
      basePrice: true,
      address: true,
      isHomeService: true,
      scheduledAt: true,
      createdAt: true,
      completedAt: true,
      beforePhotoUrl: true,
      afterPhotoUrl: true,
      service: { select: { name: true } },
      client: { select: { name: true, phone: true } },
      fleetVehicle: { select: { id: true, plateNumber: true, brand: true, model: true, color: true } },
      washer: { select: { user: { select: { name: true } } } },
      review: { select: { rating: true, comment: true } },
    },
  });
}

/** Résumé du mois pour l'accueil de l'espace entreprise et l'admin. */
export async function companySummary(companyId: string, period = currentPeriod()) {
  const { start, end } = periodBounds(period);
  const [company, contract, activeVehicles, totalVehicles, invitedDrivers, done, inProgress, invoice] =
    await Promise.all([
      db.company.findUnique({ where: { id: companyId } }),
      getActiveContract(companyId),
      db.fleetVehicle.count({ where: { companyId, isActive: true } }),
      db.fleetVehicle.count({ where: { companyId } }),
      db.fleetVehicle.count({ where: { companyId, isActive: true, carId: null } }),
      db.order.count({
        where: { companyId, isCompanyOrder: true, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
      }),
      db.order.count({
        where: {
          companyId,
          isCompanyOrder: true,
          status: { in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] },
        },
      }),
      db.companyInvoice.findUnique({ where: { companyId_period: { companyId, period } } }),
    ]);
  if (!company) throw new ServiceError('Entreprise introuvable', 404);
  const washesIncluded = (contract?.washesPerVehicle ?? 0) * activeVehicles;
  return {
    company,
    contract,
    period,
    activeVehicles,
    totalVehicles,
    invitedDrivers,
    washesDone: done,
    washesInProgress: inProgress,
    washesIncluded,
    monthlyAmount: (contract?.pricePerVehicle ?? 0) * activeVehicles,
    invoice,
  };
}

/** Génère (ou recalcule tant qu'elle n'est pas payée) la facture d'un mois. */
export async function generateInvoice(companyId: string, period = currentPeriod()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ServiceError('Période invalide (AAAA-MM)');
  const contract = await getActiveContract(companyId);
  if (!contract) throw new ServiceError("Aucun contrat actif pour cette entreprise");
  const existing = await db.companyInvoice.findUnique({ where: { companyId_period: { companyId, period } } });
  if (existing?.status === 'PAID') throw new ServiceError('Cette facture est déjà payée');

  const { start, end } = periodBounds(period);
  const [vehicleCount, washesDone] = await Promise.all([
    db.fleetVehicle.count({ where: { companyId, isActive: true } }),
    db.order.count({
      where: { companyId, isCompanyOrder: true, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    }),
  ]);
  if (vehicleCount === 0) throw new ServiceError('Aucune voiture active à facturer');

  const data = {
    vehicleCount,
    washesIncluded: vehicleCount * contract.washesPerVehicle,
    washesDone,
    pricePerVehicle: contract.pricePerVehicle,
    amount: vehicleCount * contract.pricePerVehicle,
    status: 'PENDING' as const,
  };
  if (existing) {
    return db.companyInvoice.update({ where: { id: existing.id }, data });
  }
  const seq = (await db.companyInvoice.count({ where: { period } })) + 1;
  return db.companyInvoice.create({
    data: { ...data, companyId, period, invoiceNumber: makeInvoiceNumber(period, seq) },
  });
}
