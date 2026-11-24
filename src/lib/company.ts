import { db } from '@/lib/db';

/**
 * Offre « Socline Entreprises » — logique partagée.
 *
 * Une entreprise confie une flotte (FleetVehicle) et paie un forfait mensuel
 * (CompanyContract : N lavages par voiture et par mois). Le gestionnaire et les
 * conducteurs sont INVITÉS par leur numéro : dès que ce numéro a un compte
 * Socline, linkCompanyInvitations() relie le gestionnaire à l'entreprise
 * (rôle COMPANY) et ajoute chaque voiture dans le compte de son conducteur.
 */

/** Normalise un numéro togolais (8 chiffres) — même règle que l'inscription. */
export function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/[\s.-]/g, '');
  if (p.startsWith('+228')) p = p.slice(4);
  else if (p.startsWith('00228')) p = p.slice(5);
  return p;
}

export function isValidTogoPhone(phone: string): boolean {
  return /^[79]\d{7}$/.test(phone);
}

/** Période de facturation « AAAA-MM » (heure de Lomé = UTC). */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodBounds(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** Contrat en vigueur d'une entreprise (le plus récent actif et non échu). */
export async function getActiveContract(companyId: string) {
  const now = new Date();
  return db.companyContract.findFirst({
    where: {
      companyId,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { startDate: 'desc' },
    include: { service: { select: { id: true, name: true, price: true, duration: true } } },
  });
}

/** Lavages entreprise du mois pour une voiture (commandes non annulées). */
export async function countVehicleWashes(fleetVehicleId: string, period = currentPeriod()) {
  const { start, end } = periodBounds(period);
  return db.order.count({
    where: {
      fleetVehicleId,
      isCompanyOrder: true,
      status: { not: 'CANCELLED' },
      createdAt: { gte: start, lt: end },
    },
  });
}

export interface VehicleQuota {
  fleetVehicleId: string;
  companyId: string;
  companyName: string;
  active: boolean;
  serviceId: string | null;
  serviceName: string | null;
  included: number;
  used: number;
  remaining: number;
}

/** Quota du mois d'une voiture d'entreprise. `active` = commandable maintenant. */
export async function getVehicleQuota(fleetVehicleId: string): Promise<VehicleQuota | null> {
  const vehicle = await db.fleetVehicle.findUnique({
    where: { id: fleetVehicleId },
    include: { company: { select: { id: true, name: true, isActive: true } } },
  });
  if (!vehicle) return null;
  const [contract, used] = await Promise.all([
    getActiveContract(vehicle.companyId),
    countVehicleWashes(vehicle.id),
  ]);
  const included = contract?.washesPerVehicle ?? 0;
  return {
    fleetVehicleId: vehicle.id,
    companyId: vehicle.company.id,
    companyName: vehicle.company.name,
    active: Boolean(vehicle.isActive && vehicle.company.isActive && contract),
    serviceId: contract?.serviceId ?? null,
    serviceName: contract?.service.name ?? null,
    included,
    used,
    remaining: Math.max(0, included - used),
  };
}

/**
 * Relie les invitations en attente au compte `userId` (numéro `phone`).
 * - Gestionnaire : Company.managerPhone → managerUserId ; un CLIENT passe COMPANY
 *   (un laveur ou un admin garde son rôle).
 * - Conducteur : chaque FleetVehicle actif sans voiture liée → création du Car
 *   dans le compte du conducteur.
 * Idempotent ; ne lève jamais (une erreur ne doit pas bloquer la connexion).
 * Retourne le rôle à jour de l'utilisateur.
 */
export async function linkCompanyInvitations(userId: string, phone: string): Promise<string | null> {
  try {
    const cleanPhone = normalizePhone(phone);
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) return null;
    let role: string = user.role;

    const companies = await db.company.findMany({
      where: { managerPhone: cleanPhone, managerUserId: null },
      select: { id: true },
    });
    if (companies.length > 0) {
      await db.company.updateMany({
        where: { id: { in: companies.map((c) => c.id) } },
        data: { managerUserId: userId },
      });
      if (role === 'CLIENT') {
        await db.user.update({ where: { id: userId }, data: { role: 'COMPANY' } });
        role = 'COMPANY';
      }
    }

    const vehicles = await db.fleetVehicle.findMany({
      where: { driverPhone: cleanPhone, carId: null, isActive: true },
    });
    for (const v of vehicles) {
      const hasDefault = await db.car.count({ where: { userId, isDefault: true } });
      const car = await db.car.create({
        data: {
          userId,
          plateNumber: v.plateNumber,
          brand: v.brand,
          model: v.model,
          color: v.color,
          nickname: 'Voiture de service',
          isDefault: hasDefault === 0,
        },
      });
      await db.fleetVehicle.update({ where: { id: v.id }, data: { carId: car.id } });
    }
    return role;
  } catch (error) {
    console.error('linkCompanyInvitations error:', error);
    return null;
  }
}

/**
 * Retire une voiture du compte de son conducteur (changement de conducteur ou
 * désactivation) : le Car est supprimé s'il n'a aucune commande, sinon il est
 * seulement délié (l'historique du conducteur reste intact).
 */
export async function unlinkFleetVehicle(fleetVehicleId: string): Promise<void> {
  const vehicle = await db.fleetVehicle.findUnique({ where: { id: fleetVehicleId } });
  if (!vehicle?.carId) return;
  const carId = vehicle.carId;
  await db.fleetVehicle.update({ where: { id: fleetVehicleId }, data: { carId: null } });
  const orders = await db.order.count({ where: { carId } });
  if (orders === 0) {
    await db.car.delete({ where: { id: carId } }).catch(() => {});
  }
}

/** Relie tout de suite une voiture si son conducteur a déjà un compte. */
export async function linkVehicleIfDriverExists(driverPhone: string): Promise<void> {
  const user = await db.user.findUnique({ where: { phone: normalizePhone(driverPhone) }, select: { id: true, phone: true } });
  if (user) await linkCompanyInvitations(user.id, user.phone);
}

/** Entreprise gérée par un utilisateur COMPANY (la première active). */
export async function getManagedCompany(userId: string) {
  return db.company.findFirst({ where: { managerUserId: userId }, orderBy: { createdAt: 'asc' } });
}

export function makeInvoiceNumber(period: string, seq: number): string {
  return `SCE-${period.replace('-', '')}-${String(seq).padStart(3, '0')}`;
}
