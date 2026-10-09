'use client';

import { Clock, Info } from 'lucide-react';
import { getServiceCoverage } from '@/lib/service-coverage';
import { planCarImage, CARD_CLASSES } from '@/lib/design-system';

/**
 * ServiceRowCard — carte de formule en rangée (maquette « Réserver · étape 1 ») :
 * zone illustrée carrée à gauche, nom + pastille info (détail au toucher),
 * chips visuelles (couverture / durée), prix et bouton flèche orange.
 */
export function ServiceRowCard({
  service,
  index,
  onClick,
  onInfo,
}: {
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
    coverage?: string | null;
    category?: string | null;
  };
  /** Position dans la liste → teinte (bleu, vert, orange, violet). */
  index: number;
  onClick: () => void;
  /** Appui sur la pastille info → détail du service (description complète). */
  onInfo?: () => void;
}) {
  const coverage = getServiceCoverage(service);

  return (
    <div
      className={`p-2.5 flex items-center gap-3 ${CARD_CLASSES} cursor-pointer active:scale-[0.99] transition-transform`}
      onClick={onClick}
      role="button"
      aria-label={`Choisir ${service.name}, ${service.price.toLocaleString('fr-FR')} F, ${service.duration} minutes`}
    >
      {/* Zone illustrée : vraie image de voiture, teinte selon la position */}
      <div className="w-[92px] h-[86px] rounded-[15px] overflow-hidden flex-shrink-0">
        <img
          src={planCarImage(index)}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-body font-bold text-ink truncate">{service.name}</p>
          {onInfo && (
            <button
              type="button"
              aria-label={`Détails de ${service.name}`}
              className="text-soft/60 hover:text-brand active:scale-90 transition-all flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onInfo();
              }}
            >
              <Info className="w-[15px] h-[15px]" />
            </button>
          )}
        </div>

        {/* Chips : couverture + durée */}
        <div className="flex flex-wrap gap-1.5 my-1.5">
          {coverage === 'FULL' ? (
            <span className="inline-flex items-center gap-1 text-micro font-semibold rounded-pill bg-brand-soft text-brand-deep px-2 py-0.5">
              Complet
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-micro font-semibold rounded-pill bg-plan-green text-plan-green-icon px-2 py-0.5">
              Extérieur
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-micro font-semibold rounded-pill bg-app text-soft px-2 py-0.5">
            <Clock className="w-3 h-3" strokeWidth={2.2} />
            {service.duration} min
          </span>
        </div>

        {/* Prix + flèche */}
        <div className="flex justify-between items-center">
          <span className="font-extrabold text-base text-ink">
            {service.price.toLocaleString('fr-FR')}
            <small className="text-[11px] font-bold text-brand"> F</small>
          </span>
          <span className="w-[34px] h-[34px] rounded-[11px] bg-brand grid place-items-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
