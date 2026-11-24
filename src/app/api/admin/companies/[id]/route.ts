import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { isValidTogoPhone, linkCompanyInvitations, normalizePhone } from '@/lib/company';
import { companySummary, listCompanyOrders, listVehicles } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/companies/[id] — fiche complète (résumé, véhicules, lavages, factures)
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const [summary, vehicles, orders, invoices] = await Promise.all([
      companySummary(id),
      listVehicles(id),
      listCompanyOrders(id, { take: 50 }),
      db.companyInvoice.findMany({ where: { companyId: id }, orderBy: { period: 'desc' } }),
    ]);
    const manager = summary.company.managerUserId
      ? await db.user.findUnique({ where: { id: summary.company.managerUserId }, select: { name: true, phone: true } })
      : null;
    return NextResponse.json({ success: true, ...summary, manager, vehicles, orders, invoices });
  } catch (error) {
    return companyApiError(error, 'Admin company GET');
  }
}

// PATCH /api/admin/companies/[id] — modifie l'entreprise et/ou son contrat
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const body = await request.json();
    const company = await db.company.findUnique({ where: { id } });
    if (!company) return NextResponse.json({ success: false, error: 'Entreprise introuvable' }, { status: 404 });

    const data: Record<string, unknown> = {};
    for (const key of ['name', 'sector', 'address', 'contactName', 'email', 'taxId'] as const) {
      if (body[key] !== undefined) data[key] = String(body[key] ?? '').trim() || (key === 'name' ? company.name : null);
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    let managerChanged = false;
    if (body.managerPhone !== undefined) {
      const phone = normalizePhone(String(body.managerPhone));
      if (!isValidTogoPhone(phone)) {
        return NextResponse.json({ success: false, error: 'Numéro du gestionnaire invalide' }, { status: 400 });
      }
      if (phone !== company.managerPhone) {
        managerChanged = true;
        data.managerPhone = phone;
        data.managerUserId = null;
      }
    }
    await db.company.update({ where: { id }, data });

    if (body.contract) {
      const c = body.contract;
      const current = await db.companyContract.findFirst({
        where: { companyId: id, isActive: true },
        orderBy: { startDate: 'desc' },
      });
      const contractData: Record<string, unknown> = {};
      if (c.serviceId !== undefined) contractData.serviceId = String(c.serviceId);
      if (c.washesPerVehicle !== undefined) contractData.washesPerVehicle = Math.max(1, Math.min(31, Math.round(Number(c.washesPerVehicle))));
      if (c.pricePerVehicle !== undefined) contractData.pricePerVehicle = Math.max(0, Number(c.pricePerVehicle) || 0);
      if (c.maxVehicles !== undefined) contractData.maxVehicles = Math.max(1, Math.round(Number(c.maxVehicles)));
      if (c.endDate !== undefined) contractData.endDate = c.endDate ? new Date(c.endDate) : null;
      if (c.notes !== undefined) contractData.notes = String(c.notes || '').trim() || null;
      if (c.isActive !== undefined) contractData.isActive = Boolean(c.isActive);
      if (current) {
        await db.companyContract.update({ where: { id: current.id }, data: contractData });
      } else if (contractData.serviceId && contractData.pricePerVehicle !== undefined) {
        await db.companyContract.create({
          data: { companyId: id, ...(contractData as { serviceId: string; pricePerVehicle: number }) },
        });
      }
    }

    if (managerChanged) {
      const manager = await db.user.findUnique({ where: { phone: data.managerPhone as string }, select: { id: true, phone: true } });
      if (manager) await linkCompanyInvitations(manager.id, manager.phone);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return companyApiError(error, 'Admin company PATCH');
  }
}
