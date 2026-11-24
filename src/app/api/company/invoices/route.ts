import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireManagedCompany } from '@/lib/company-session';
import { companyApiError } from '@/lib/company-api';

// GET /api/company/invoices — factures mensuelles de l'entreprise
export async function GET(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    const invoices = await db.companyInvoice.findMany({
      where: { companyId: company.id, status: { not: 'CANCELLED' } },
      orderBy: { period: 'desc' },
    });
    return NextResponse.json({ success: true, invoices, company: { name: company.name, address: company.address, taxId: company.taxId } });
  } catch (error) {
    return companyApiError(error, 'Company invoices GET');
  }
}
