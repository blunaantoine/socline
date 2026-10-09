'use client';

/**
 * Segmented — sélecteur segmenté (ex. Indépendants / Stations).
 * Piste gris clair, option active = carte blanche avec ombre discrète.
 * Zones tactiles ≥ 44 px (padding 10 px vertical).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[#E9ECF1] rounded-btn p-1" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-h-[40px] py-2.5 rounded-[9px] text-body font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              active ? 'bg-surface text-ink shadow-pop' : 'text-soft'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
