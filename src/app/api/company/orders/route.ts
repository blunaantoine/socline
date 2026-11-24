import { NextRequest, NextResponse } from 'next/server';
import { requireManagedCompany } from '@/lib/company-session';
import { listCompanyOrders } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

// GET /api/company/orders?period=AAAA-MM&vehicleId=… — lavages de la flotte
export async function GET(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const orders = await listCompanyOrders(company.id, {
      period: period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : undefined,
      vehicleId: searchParams.get('vehicleId') || undefined,
    });
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return companyApiError(error, 'Company orders GET');
  }
}
