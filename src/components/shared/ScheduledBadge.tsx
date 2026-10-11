'use client';

import { CalendarClock } from 'lucide-react';
import { formatScheduledShort } from '@/lib/scheduled';

/**
 * Badge « rendez-vous planifié » — affiché partout où une commande a une
 * date choisie par le client (« Plus tard ») : job pool du laveur, commandes
 * en cours, historique client. Invisible pour les commandes immédiates.
 */
export function ScheduledBadge({
  scheduledAt,
  className = '',
}: {
  scheduledAt: string | Date | null | undefined;
  className?: string;
}) {
  const label = formatScheduledShort(scheduledAt);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[#FFF3E0] px-2 py-0.5 text-xs font-semibold text-[#E65100] ${className}`}
    >
      <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      Planifié : {label}
    </span>
  );
}
