import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireCompany } from '@/lib/auth';
import { getManagedCompany } from '@/lib/company';

/**
 * Session gestionnaire d'entreprise : vérifie le rôle COMPANY et renvoie
 * l'entreprise gérée. Toutes les routes /api/company/* sont limitées à elle.
 */
export async function requireManagedCompany(request: NextRequest) {
  const auth = await requireCompany(request);
  if (!auth.authorized || !auth.user) return { company: null, response: auth.response! };
  const company = await getManagedCompany(auth.user.id);
  if (!company) {
    return {
      company: null,
      response: NextResponse.json({ success: false, error: 'Aucune entreprise associée à ce compte' }, { status: 404 }),
    };
  }
  return { company, response: null };
}
