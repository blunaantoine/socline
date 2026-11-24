import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createVehicle, updateVehicle } from '@/lib/company-service';
import { companyApiError } from '@/lib/company-api';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/companies/[id]/vehicles — ajoute une voiture (et invite son conducteur)
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const vehicle = await createVehicle(id, await request.json());
    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    return companyApiError(error, 'Admin fleet vehicle POST');
  }
}

// PATCH /api/admin/companies/[id]/vehicles — { vehicleId, ...champs }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response!;
  try {
    const { id } = await params;
    const { vehicleId, ...input } = await request.json();
    if (!vehicleId) return NextResponse.json({ success: false, error: 'vehicleId requis' }, { status: 400 });
    const vehicle = await updateVehicle(id, String(vehicleId), input);
    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    return companyApiError(error, 'Admin fleet vehicle PATCH');
  }
}
