'use client';

import { Armchair, Car, Clock } from 'lucide-react';
import { getServiceCoverage } from '@/lib/service-coverage';
import { planTint } from '@/lib/design-system';
import { CarIllustration } from './CarIllustration';

export interface ServiceLike {
  id: string;
  name: string;
  price: number;
  duration: number;
  coverage?: string | null;
  category?: string | null;
}

/**
 * ServiceArtCard — carte de formule : zone teintée avec illustration
 * voiture + pastilles icônes (carrosserie / intérieur), nom, prix et
 * durée. Remplace les cartes textuelles descriptives.
 */
export function ServiceArtCard({
  service,
  index,
  onClick,
  description,
}: {
  service: ServiceLike;
  /** Position dans la liste → teinte (bleu, vert, orange, violet). */
  index: number;
  onClick: () => void;
  /** Description courte facultative (1 ligne max, tronquée). */
  description?: string;
}) {
  const tint = planTint(index);
  const coverage = getServiceCoverage(service);
  const isFull = coverage === 'FULL';

  return (
    <button
      onClick={onClick}
      className="w-full bg-surface rounded-card border border-line shadow-card overflow-hidden text-left active:scale-[0.98] transition-transform"
    >
      {/* Zone illustrée teintée */}
      <div className={`relative h-[92px] grid place-items-center ${tint.bg}`}>
        {/* Pastilles : ce que le lavage inclut */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="w-6 h-6 rounded-[8px] bg-white/90 grid place-items-center">
            <Car className={`w-3.5 h-3.5 ${tint.icon}`} strokeWidth={2.4} />
          </span>
          {isFull && (
            <span className="w-6 h-6 rounded-[8px] bg-white/90 grid place-items-center">
              <Armchair className={`w-3.5 h-3.5 ${tint.icon}`} strokeWidth={2.4} />
            </span>
          )}
        </div>
        <CarIllustration className={`w-[112px] ${tint.icon}`} />
      </div>

      {/* Infos : nom + description courte + prix / durée */}
      <div className="px-3 pt-2.5 pb-3">
        <p className="text-body font-semibold text-ink mb-0.5 truncate">{service.name}</p>
        {description && (
          <p className="text-detail text-soft line-clamp-1 mb-1">{description}</p>
        )}
        <div className="flex justify-between items-center">
          <span className="font-extrabold text-base text-ink">
            {service.price.toLocaleString('fr-FR')}
            <small className="text-[11px] font-bold text-brand"> F</small>
          </span>
          <span className="text-detail text-soft flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={2.2} />
            {service.duration} min
          </span>
        </div>
      </div>
    </button>
  );
}
