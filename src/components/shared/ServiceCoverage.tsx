'use client';

// Shared UI pieces to display what a wash service covers.
// Used by the home offers grid, the order flow, station lists and modals so the
// difference between "Extérieur seul" and "Complet (extérieur + intérieur)" is
// always visible at a glance.

import { Zap, Droplets, Sparkles, Crown, Car, Armchair, CheckCircle2, XCircle } from 'lucide-react';
import { getServiceCoverage, getCoverageDetails } from '@/lib/service-coverage';

/** Icon for a service based on its category (works with all naming variants). */
export function ServiceIcon({ service, className = 'w-5 h-5' }: { service: any; className?: string }) {
  const cat = (service?.category || '').toLowerCase();
  if (cat === 'essentiel' || cat === 'basic') return <Zap className={className} />;
  if (cat === 'confort' || cat === 'standard') return <Droplets className={className} />;
  if (cat === 'premium') return <Sparkles className={className} />;
  if (cat === 'prestige' || cat === 'deluxe') return <Crown className={className} />;
  return <Droplets className={className} />;
}

/**
 * Compact pill badge: "Extérieur" (green) vs "Complet" (orange).
 * Shows the full labels on wide surfaces, short ones on tiny cards.
 */
export function CoverageBadge({
  service,
  short = false,
  className = '',
}: {
  service: any;
  short?: boolean;
  className?: string;
}) {
  const coverage = getServiceCoverage(service);
  const isExterior = coverage === 'EXTERIOR';
  const label = isExterior ? (short ? 'Extérieur' : 'Extérieur seul') : short ? 'Complet' : 'Complet (ext. + int.)';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
        isExterior ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#FFF3E0] text-[#E65100]'
      } ${className}`}
    >
      <Car className="w-3 h-3 flex-shrink-0" />
      {label}
      {!isExterior && <Armchair className="w-3 h-3 flex-shrink-0" />}
    </span>
  );
}

/**
 * Detailed inclusion list used in service detail modals:
 * - Extérieur: always included (green check + explanation)
 * - Intérieur: included only for FULL coverage, otherwise a gray cross.
 */
export function CoverageDetails({ service }: { service: any }) {
  const { exterior, interior } = getCoverageDetails(service);

  return (
    <div>
      <p className="text-sm font-medium text-[#212121] mb-2">Ce que comprend le lavage</p>
      <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <Car className="w-4 h-4 text-[#FF9800] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#212121]">Extérieur</p>
            <p className="text-xs text-[#616161] leading-relaxed">{exterior}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          {interior ? (
            <>
              <Armchair className="w-4 h-4 text-[#4CAF50] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#212121] flex items-center gap-1.5">
                  Intérieur
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#2E7D32]">
                    <CheckCircle2 className="w-3 h-3" /> Inclus
                  </span>
                </p>
                <p className="text-xs text-[#616161] leading-relaxed">{interior}</p>
              </div>
            </>
          ) : (
            <>
              <Armchair className="w-4 h-4 text-[#9E9E9E] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#757575] flex items-center gap-1.5">
                  Intérieur
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#9E9E9E]">
                    <XCircle className="w-3 h-3" /> Non inclus
                  </span>
                </p>
                <p className="text-xs text-[#9E9E9E] leading-relaxed">
                  Choisissez « Confort », « Premium » ou « Prestige » pour un intérieur nettoyé.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
