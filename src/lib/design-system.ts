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

/**
 * Scènes illustrées des formules de LAVAGE (Accueil « Nos formules » et
 * Réserver) : chaque prestation affiche une image DIFFÉRENTE, choisie
 * d'abord selon sa couverture puis alternée selon sa position —
 *  · EXTÉRIEUR  → mousse et éponge, puis laveur au jet haute pression ;
 *  · COMPLET → brillance miroir, puis aspiration intérieure, puis detailing.
 * Une même prestation garde toujours la même image (reconnaissance
 * visuelle identique entre l'accueil et la réservation).
 */
export const SERVICE_ART_IMAGES = {
  EXTERIOR: [
    '/voitures/services/mousse.png',
    '/voitures/services/laveur-hydro.png',
  ],
  FULL: [
    '/voitures/services/brillance.png',
    '/voitures/services/interieur.png',
    '/voitures/services/detailing.png',
  ],
} as const;

/** Image d'illustration d'un service : scène adaptée à sa couverture. */
export function serviceArtImage(coverage: string | null | undefined, index: number) {
  const pool = coverage === 'FULL' ? SERVICE_ART_IMAGES.FULL : SERVICE_ART_IMAGES.EXTERIOR;
  return pool[((index % pool.length) + pool.length) % pool.length];
}

/**
 * Images des FORMULES D'ABONNEMENT : une voiture différente par niveau —
 * Essentiel = citadine étincelante, Confort = berline à la mousse,
 * Premium = SUV passé au jet par un laveur, Prestige = berline noire
 * de luxe finition detailing.
 */
export const PLAN_PRIORITY_IMAGES = [
  '/voitures/plans/essentiel.png',
  '/voitures/plans/confort.png',
  '/voitures/plans/premium.png',
  '/voitures/plans/prestige.png',
] as const;

/** Image d'une formule d'abonnement selon sa priorité (bornée 0 → 3). */
export function planPriorityImage(priority: number) {
  const i = Math.min(Math.max(priority, 0), PLAN_PRIORITY_IMAGES.length - 1);
  return PLAN_PRIORITY_IMAGES[i];
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
