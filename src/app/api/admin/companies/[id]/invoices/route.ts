import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { currentPeriod } from '@/lib/company';
import { generateInvoice } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/companies/[id]/invoices — { period? } génère / recalcule la facture du mois
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const invoice = await generateInvoice(id, body.period || currentPeriod());
    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    return companyApiError(error, 'Admin company invoice POST');
  }
}

// PATCH /api/admin/companies/[id]/invoices — { invoiceId, status: 'PAID'|'PENDING'|'CANCELLED', paymentReference? }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const { invoiceId, status, paymentReference } = await request.json();
    if (!['PAID', 'PENDING', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Statut invalide' }, { status: 400 });
    }
    const invoice = await db.companyInvoice.findFirst({ where: { id: String(invoiceId), companyId: id } });
    if (!invoice) return NextResponse.json({ success: false, error: 'Facture introuvable' }, { status: 404 });
    const updated = await db.companyInvoice.update({
      where: { id: invoice.id },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
        paymentReference: paymentReference !== undefined ? String(paymentReference || '').trim() || null : invoice.paymentReference,
      },
    });
    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    return companyApiError(error, 'Admin company invoice PATCH');
  }
}
