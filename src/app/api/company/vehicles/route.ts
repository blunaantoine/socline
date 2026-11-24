import { NextRequest, NextResponse } from 'next/server';
import { requireManagedCompany } from '@/lib/company-session';
import { createVehicle, listVehicles, updateVehicle } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

// GET /api/company/vehicles — flotte avec quota du mois et état des conducteurs
export async function GET(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    return NextResponse.json({ success: true, vehicles: await listVehicles(company.id) });
  } catch (error) {
    return companyApiError(error, 'Company vehicles GET');
  }
}

// POST /api/company/vehicles — ajoute une voiture et invite son conducteur
export async function POST(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    const vehicle = await createVehicle(company.id, await request.json());
    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    return companyApiError(error, 'Company vehicles POST');
  }
}

// PATCH /api/company/vehicles — { vehicleId, ...champs } (conducteur, plaque, activer/retirer)
export async function PATCH(request: NextRequest) {
  const { company, response } = await requireManagedCompany(request);
  if (!company) return response;
  try {
    const { vehicleId, ...input } = await request.json();
    if (!vehicleId) return NextResponse.json({ success: false, error: 'vehicleId requis' }, { status: 400 });
    const vehicle = await updateVehicle(company.id, String(vehicleId), input);
    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    return companyApiError(error, 'Company vehicles PATCH');
  }
}
