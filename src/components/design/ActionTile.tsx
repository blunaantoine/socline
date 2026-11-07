'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

/**
 * ActionTile — tuiles d'action de l'Accueil (inspiration « super-app »).
 *  · `ActionTileLarge` : grande tuile illustrée (action principale), fond teinté,
 *    titre + sous-titre, illustration en bas à droite.
 *  · `ActionTileSmall` : petit raccourci carré (icône teintée + libellé court).
 * Couleurs : uniquement les utilitaires du design system (globals.css).
 */
export function ActionTileLarge({
  title,
  subtitle,
  image,
  tint,
  onClick,
}: {
  title: string;
  subtitle: string;
  image: string;
  /** Classe de fond teinté, ex. `bg-brand-soft`, `bg-plan-blue`. */
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-card ${tint} p-3.5 min-h-[184px] flex flex-col text-left active:scale-[0.97] transition-transform`}
    >
      <span className="text-section text-ink leading-tight pr-1">{title}</span>
      <span className="text-detail text-soft mt-1 leading-snug">{subtitle}</span>
      <span className="relative z-10 mt-auto w-8 h-8 rounded-full bg-surface grid place-items-center shadow-pop">
        <ArrowRight className="w-4 h-4 text-ink" strokeWidth={2.4} />
      </span>
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute right-0 bottom-0 w-[58%] max-w-[120px] aspect-square object-cover rounded-tl-[24px]"
      />
    </button>
  );
}

export function ActionTileSmall({
  label,
  icon: Icon,
  tint,
  iconColor,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform"
    >
      <span className={`w-[58px] h-[58px] rounded-[18px] grid place-items-center ${tint}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} strokeWidth={2} />
      </span>
      <span className="text-detail font-semibold text-ink leading-tight text-center">{label}</span>
    </button>
  );
}
