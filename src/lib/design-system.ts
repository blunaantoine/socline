/**
 * DESIGN SYSTEM SOCLINE — helpers partagés.
 *
 * Les valeurs brutes (couleurs, rayons, ombres) vivent dans
 * `src/app/globals.css` (variables CSS + @theme). Ce fichier expose les
 * choix structurés réutilisés par les écrans : attribution des teintes
 * de formule, classes utilitaires des pastilles de couverture, etc.
 * Aucun écran ne doit écrire une couleur ou un rayon en dur.
 */

import type { ServiceCoverage } from './service-coverage';

/** Les 4 teintes de formule (bleu → vert → orange → violet). */
export const PLAN_TINTS = [
  { bg: 'bg-plan-blue', icon: 'text-plan-blue-icon' },
  { bg: 'bg-plan-green', icon: 'text-plan-green-icon' },
  { bg: 'bg-plan-orange', icon: 'text-plan-orange-icon' },
  { bg: 'bg-plan-purple', icon: 'text-plan-purple-icon' },
] as const;

/** Teinte d'une formule selon sa position dans la liste (cycle des 4). */
export function planTint(index: number) {
  return PLAN_TINTS[index % PLAN_TINTS.length];
}

/**
 * Pastilles icônes de couverture affichées sur les cartes de formule :
 * petit badge blanc (carrosserie / intérieur) au-dessus de l'illustration.
 * Remplace les blocs de texte explicatifs « Extérieur / Complet ».
 */
export const COVERAGE_BADGE_STYLES: Record<ServiceCoverage, string> = {
  EXTERIOR: 'bg-white/90',
  FULL: 'bg-white/90',
};

/** Utilitaires communs des cartes (rayon 20 px, bordure fine, ombre légère). */
export const CARD_CLASSES = 'bg-surface rounded-card border border-line shadow-card';
/** Utilitaires du bouton principal (orange de marque). */
export const BTN_PRIMARY_CLASSES = 'bg-brand hover:bg-brand-strong text-white rounded-btn';
/** Utilitaires du bouton secondaire (navy). */
export const BTN_SECONDARY_CLASSES = 'bg-ink hover:bg-ink-2 text-white rounded-btn';
