import { NextRequest, NextResponse } from 'next/server';
import { requireManagedCompany } from '@/lib/company-session';
import { companySummary } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

// GET /api/company/summary — accueil de l'espace entreprise (mois en cours)
export async function GET(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    const summary = await companySummary(company.id);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    return companyApiError(error, 'Company summary');
  }
}
