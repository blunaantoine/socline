'use client';

import type { LucideIcon } from 'lucide-react';
import { Droplets, Wrench, Warehouse, PaintBucket } from 'lucide-react';

/**
 * ServiceHub — grille des catégories de services automobiles de l'Accueil.
 *
 * L'accueil n'est plus centré sur le lavage : il présente Socline comme un
 * compagnon auto complet. Chaque catégorie est une entrée de la grille ;
 * celles qui ne sont pas encore ouvertes affichent « Bientôt » et ne
 * déclenchent aucune action. Pour ajouter une catégorie (ex. dépannage
 * ouvert), il suffit de passer `available: true` + `onSelect` dans CATEGORIES.
 */
export type ServiceCategoryId = 'wash' | 'tow' | 'garage' | 'paint';

interface ServiceCategory {
  id: ServiceCategoryId;
  label: string;
  icon: LucideIcon;
  /** Teinte douce (classes du design system : bg-plan-* / text-plan-*-icon). */
  tint: string;
  iconColor: string;
  available: boolean;
}

const CATEGORIES: ServiceCategory[] = [
  { id: 'wash', label: 'Lavage', icon: Droplets, tint: 'bg-plan-blue', iconColor: 'text-plan-blue-icon', available: true },
  { id: 'tow', label: 'Dépannage', icon: Wrench, tint: 'bg-plan-orange', iconColor: 'text-plan-orange-icon', available: false },
  { id: 'garage', label: 'Garages', icon: Warehouse, tint: 'bg-plan-green', iconColor: 'text-plan-green-icon', available: false },
  { id: 'paint', label: 'Peinture', icon: PaintBucket, tint: 'bg-plan-purple', iconColor: 'text-plan-purple-icon', available: false },
];

export function ServiceHub({
  onSelect,
}: {
  /** Appelé uniquement pour une catégorie disponible. */
  onSelect: (id: ServiceCategoryId) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2.5" aria-label="Catégories de services">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            type="button"
            disabled={!cat.available}
            onClick={() => cat.available && onSelect(cat.id)}
            className={`relative flex flex-col items-center gap-2 rounded-card border border-line bg-surface shadow-card px-1 pt-3.5 pb-3 min-h-[92px] transition-transform ${
              cat.available ? 'active:scale-95' : 'opacity-70 cursor-default'
            }`}
          >
            <span className={`w-11 h-11 rounded-[14px] grid place-items-center ${cat.tint}`}>
              <Icon className={`w-[22px] h-[22px] ${cat.iconColor}`} strokeWidth={2} />
            </span>
            <span className="text-detail font-semibold text-ink leading-tight">{cat.label}</span>
            {!cat.available && (
              <span className="-mt-1 rounded-pill bg-app text-soft text-[9px] font-semibold px-1.5 py-0.5 leading-none">
                Bientôt
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
