import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { currentPeriod, isValidTogoPhone, linkCompanyInvitations, normalizePhone, periodBounds } from '@/lib/company';
import { companyApiError } from '@/lib/company-api';

// GET /api/admin/companies — entreprises clientes avec contrat et activité du mois
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { start, end } = periodBounds(currentPeriod());
    const companies = await db.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { id: true, name: true, phone: true } },
        contracts: {
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          take: 1,
          include: { service: { select: { id: true, name: true, price: true } } },
        },
        _count: { select: { vehicles: { where: { isActive: true } } } },
      },
    });
    const washes = await db.order.groupBy({
      by: ['companyId'],
      where: { isCompanyOrder: true, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const done = new Map(washes.map((w) => [w.companyId, w._count._all]));
    return NextResponse.json({
      success: true,
      companies: companies.map((c) => ({
        ...c,
        contract: c.contracts[0] ?? null,
        activeVehicles: c._count.vehicles,
        washesThisMonth: done.get(c.id) ?? 0,
      })),
    });
  } catch (error) {
    return companyApiError(error, 'Admin companies GET');
  }
}

// POST /api/admin/companies — crée l'entreprise et son contrat
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const managerPhone = normalizePhone(String(body.managerPhone || ''));
    const serviceId = String(body.serviceId || '');
    const washesPerVehicle = Number(body.washesPerVehicle);
    const pricePerVehicle = Number(body.pricePerVehicle);
    const maxVehicles = Number(body.maxVehicles);

    if (!name) return NextResponse.json({ success: false, error: "Le nom de l'entreprise est requis" }, { status: 400 });
    if (!isValidTogoPhone(managerPhone)) {
      return NextResponse.json({ success: false, error: 'Numéro du gestionnaire invalide' }, { status: 400 });
    }
    if (!serviceId || !(await db.service.findUnique({ where: { id: serviceId } }))) {
      return NextResponse.json({ success: false, error: 'Formule invalide' }, { status: 400 });
    }
    if (!Number.isInteger(washesPerVehicle) || washesPerVehicle < 1 || washesPerVehicle > 31) {
      return NextResponse.json({ success: false, error: 'Lavages par voiture : entre 1 et 31' }, { status: 400 });
    }
    if (!Number.isFinite(pricePerVehicle) || pricePerVehicle < 0) {
      return NextResponse.json({ success: false, error: 'Prix par voiture invalide' }, { status: 400 });
    }
    if (!Number.isInteger(maxVehicles) || maxVehicles < 1 || maxVehicles > 500) {
      return NextResponse.json({ success: false, error: 'Nombre de voitures : entre 1 et 500' }, { status: 400 });
    }

    const company = await db.company.create({
      data: {
        name,
        sector: body.sector?.trim() || null,
        address: body.address?.trim() || null,
        contactName: body.contactName?.trim() || null,
        email: body.email?.trim() || null,
        taxId: body.taxId?.trim() || null,
        managerPhone,
        contracts: {
          create: {
            serviceId,
            washesPerVehicle,
            pricePerVehicle,
            maxVehicles,
            startDate: body.startDate ? new Date(body.startDate) : new Date(),
            endDate: body.endDate ? new Date(body.endDate) : null,
            notes: body.notes?.trim() || null,
          },
        },
      },
    });

    // Le gestionnaire a déjà un compte : il est relié tout de suite.
    const manager = await db.user.findUnique({ where: { phone: managerPhone }, select: { id: true, phone: true } });
    if (manager) await linkCompanyInvitations(manager.id, manager.phone);

    return NextResponse.json({ success: true, company });
  } catch (error) {
    return companyApiError(error, 'Admin companies POST');
  }
}
