import { NextResponse } from 'next/server';
import { ServiceError } from '@/lib/company-service';

/** Réponse JSON uniforme pour les erreurs des routes Entreprises. */
export function companyApiError(error: unknown, context: string) {
  if (error instanceof ServiceError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(`${context}:`, error);
  return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
}
