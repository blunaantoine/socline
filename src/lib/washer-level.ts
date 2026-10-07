/**
 * Barème de rémunération progressive du Contrat de Partenariat SOCLINE (Article 5).
 *
 * Le Partenaire perçoit une commission sur le prix de chaque prestation réalisée
 * et payée par le client. Cette commission augmente au fur et à mesure que le
 * Partenaire fait preuve de régularité et de qualité de travail :
 *
 * Niveau 1 – Départ    : dès la signature du contrat                          → 60 %
 * Niveau 2 – Confirmé  : 30 prestations, note moyenne ≥ 4,0/5                → 65 %
 * Niveau 3 – Expert    : 80 prestations, note ≥ 4,3/5, < 10 % d'annulations  → 70 %
 * Niveau 4 – Référent  : 150 prestations, note ≥ 4,5/5, < 7 % d'annulations  → 75 %
 * Niveau 5 – Excellence: 300 prestations, note ≥ 4,7/5, < 5 % d'annulations  → 80 %
 *
 * Conformité à l'Article 5 du contrat :
 * - "Dès que les conditions du niveau supérieur sont remplies, le nouveau taux
 *   s'applique automatiquement aux prestations suivantes" → le niveau est
 *   recalculé à chaque acceptation de commande (évaluation continue).
 * - "Le taux n'est jamais modifié pour les prestations déjà réalisées" → la
 *   commission est figée sur l'Order au moment de l'acceptation.
 *
 * Critères non (encore) mesurés par l'Application, considérés remplis :
 * - Niveau 2 "ponctualité respectée" ;
 * - Niveau 5 "aucune plainte grave sur 3 mois".
 */

export interface PartnerLevel {
  level: number;
  name: string;
  /** Part du Partenaire en % (Article 5) */
  share: number;
  /** Commission de la Société (1 - share/100), appliquée au prix de la prestation */
  commissionRate: number;
  /** Nombre minimal de prestations réalisées */
  minJobs: number;
  /** Note moyenne minimale (sur 5) */
  minRating: number;
  /** Taux d'annulations maximal en % (null = critère non applicable) */
  maxCancellationRate: number | null;
  /** Description des conditions (texte du contrat) */
  description: string;
}

export const PARTNER_LEVELS: PartnerLevel[] = [
  {
    level: 1,
    name: 'Départ',
    share: 60,
    commissionRate: 0.4,
    minJobs: 0,
    minRating: 0,
    maxCancellationRate: null,
    description: 'Dès la signature du contrat',
  },
  {
    level: 2,
    name: 'Confirmé',
    share: 65,
    commissionRate: 0.35,
    minJobs: 30,
    minRating: 4.0,
    maxCancellationRate: null,
    description: '30 prestations réalisées, note moyenne ≥ 4,0 / 5',
  },
  {
    level: 3,
    name: 'Expert',
    share: 70,
    commissionRate: 0.3,
    minJobs: 80,
    minRating: 4.3,
    maxCancellationRate: 10,
    description: '80 prestations, note moyenne ≥ 4,3 / 5, moins de 10 % d\u2019annulations',
  },
  {
    level: 4,
    name: 'Référent',
    share: 75,
    commissionRate: 0.25,
    minJobs: 150,
    minRating: 4.5,
    maxCancellationRate: 7,
    description: '150 prestations, note moyenne ≥ 4,5 / 5, moins de 7 % d\u2019annulations',
  },
  {
    level: 5,
    name: 'Excellence',
    share: 80,
    commissionRate: 0.2,
    minJobs: 300,
    minRating: 4.7,
    maxCancellationRate: 5,
    description: '300 prestations, note moyenne ≥ 4,7 / 5, moins de 5 % d\u2019annulations',
  },
];

export const DEFAULT_PARTNER_LEVEL: PartnerLevel = PARTNER_LEVELS[0];

export interface PartnerStats {
  completedJobs: number;
  /** Note moyenne du laveur (0 par défaut) */
  rating: number;
  /** Taux d'annulations en % (0 par défaut) */
  cancellationRate: number;
}

/**
 * Détermine le niveau du Partenaire à partir des stats mesurées par
 * l'Application. Renvoie le niveau le plus élevé dont TOUTES les conditions
 * sont remplies.
 */
export function computePartnerLevel(stats: PartnerStats): PartnerLevel {
  let current = DEFAULT_PARTNER_LEVEL;
  for (const lvl of PARTNER_LEVELS) {
    if (
      stats.completedJobs >= lvl.minJobs &&
      stats.rating >= lvl.minRating &&
      (lvl.maxCancellationRate === null || stats.cancellationRate < lvl.maxCancellationRate)
    ) {
      current = lvl;
    }
  }
  return current;
}

/** Commission de la Société pour un montant donné, selon le niveau du Partenaire */
export function commissionForLevel(level: PartnerLevel, amount: number): number {
  return Math.round(amount * level.commissionRate);
}
