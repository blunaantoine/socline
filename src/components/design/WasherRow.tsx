'use client';

import { Star } from 'lucide-react';

/**
 * WasherRow — carte laveur en ligne : avatar (initiale + dégradé de
 * marque + point vert « en ligne »), nom, note en étoiles, statut,
 * et un seul bouton d'action clair (navy).
 */
export function WasherRow({
  name,
  rating,
  jobs,
  avatar,
  actionLabel = 'Réserver',
  onAction,
}: {
  name: string;
  rating: number;
  jobs?: number;
  avatar?: string | null;
  actionLabel?: string;
  onAction: () => void;
}) {
  const isNew = rating <= 0;
  return (
    <div className="w-full bg-surface border border-line rounded-card shadow-card p-3 flex items-center gap-3">
      {/* Avatar + point en ligne */}
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img src={avatar} alt={name} className="w-[54px] h-[54px] rounded-[18px] object-cover" />
        ) : (
          <div className="w-[54px] h-[54px] rounded-[18px] bg-gradient-to-br from-brand to-[#FFB547] text-white font-extrabold text-[22px] grid place-items-center">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-success border-[3px] border-white" />
      </div>

      {/* Identité + note / statut */}
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-ink truncate">{name}</p>
        <span className="text-detail text-soft flex items-center gap-1.5 mt-0.5 overflow-hidden whitespace-nowrap">
          <Star className="w-3.5 h-3.5 text-star fill-star flex-shrink-0" />
          <span className="truncate">
            {isNew ? 'Nouveau' : rating.toFixed(1)}
            <span aria-hidden="true"> · </span>en ligne
            {jobs ? (
              <>
                <span aria-hidden="true"> · </span>
                {jobs} lavage{jobs > 1 ? 's' : ''}
              </>
            ) : null}
          </span>
        </span>
      </div>

      {/* Action unique */}
      <button
        onClick={onAction}
        className="flex-shrink-0 bg-ink hover:bg-ink-2 text-white rounded-btn px-4 py-2.5 text-detail font-bold active:scale-95 transition-transform min-h-[44px]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
