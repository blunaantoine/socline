// Shared helpers to make the difference between an exterior-only wash and a
// complete wash (exterior + interior) explicit everywhere in the app.
//
//  - EXTERIOR : lavage extérieur seul (carrosserie, vitres, jantes)
//  - FULL     : lavage complet (extérieur + intérieur)

export type ServiceCoverage = 'EXTERIOR' | 'FULL';

export interface CoverageServiceLike {
  coverage?: string | null;
  category?: string | null;
}

/**
 * Resolve the coverage of a service.
 * Uses the explicit `coverage` field when present, falls back to the legacy
 * category names so old rows/services created before the field keep working.
 */
export function getServiceCoverage(service: CoverageServiceLike | null | undefined): ServiceCoverage {
  if (service?.coverage === 'EXTERIOR' || service?.coverage === 'FULL') return service.coverage;
  const cat = (service?.category || '').toLowerCase();
  if (cat === 'essentiel' || cat === 'basic' || cat === 'exterior') return 'EXTERIOR';
  return 'FULL';
}

export const COVERAGE_LABEL: Record<ServiceCoverage, string> = {
  EXTERIOR: 'Extérieur seul',
  FULL: 'Complet',
};

// Long variant used in summaries / detail rows
export const COVERAGE_LONG_LABEL: Record<ServiceCoverage, string> = {
  EXTERIOR: 'Extérieur seul (carrosserie)',
  FULL: 'Complet (extérieur + intérieur)',
};

// Short variant for compact cards
export const COVERAGE_SHORT_LABEL: Record<ServiceCoverage, string> = {
  EXTERIOR: 'Extérieur',
  FULL: 'Complet',
};

/**
 * Human-readable details of what each part of the wash includes.
 * `interior` is null when the service does not cover the interior.
 */
export function getCoverageDetails(service: CoverageServiceLike | null | undefined): {
  exterior: string;
  interior: string | null;
} {
  const coverage = getServiceCoverage(service);
  const cat = (service?.category || '').toLowerCase();

  const exteriorByCat: Record<string, string> = {
    essentiel: 'Carrosserie, vitres et jantes — rinçage + séchage manuel sans traces',
    basic: 'Carrosserie, vitres et jantes — rinçage + séchage manuel sans traces',
    confort: 'Carrosserie complète, vitres et jantes',
    standard: 'Carrosserie complète, vitres et jantes',
    premium: 'Carrosserie approfondie avec produits haute qualité',
    prestige: 'Carrosserie + polish rénovateur et cire protectrice',
  };
  const interiorByCat: Record<string, string> = {
    confort: 'Dépoussiérage et nettoyage des surfaces visibles (tableau de bord, plastiques)',
    standard: 'Dépoussiérage et nettoyage des surfaces visibles (tableau de bord, plastiques)',
    premium: 'Aspiration complète, traitement des sièges et assainissement de l\'habitacle',
    prestige: 'Rénovation des plastiques, produits haut de gamme et désodorisant longue durée',
  };

  const exterior = exteriorByCat[cat] || 'Carrosserie, vitres et jantes';
  const interior =
    coverage === 'FULL'
      ? interiorByCat[cat] || 'Nettoyage de l\'habitacle (aspiration + surfaces intérieures)'
      : null;

  return { exterior, interior };
}

/** Format a XOF price consistently: "2 500 F" */
export function formatPrice(price: number | undefined | null): string {
  const value = typeof price === 'number' && Number.isFinite(price) ? price : 0;
  return `${value.toLocaleString('fr-FR')} F`;
}
