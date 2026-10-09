'use client';

/**
 * SectionHeader — en-tête de section Accueil : titre court (2-3 mots)
 * + action facultative en orange (ex. « Voir tout »).
 */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex justify-between items-baseline mb-3">
      <h3 className="text-section text-ink">{title}</h3>
      {action && (
        <button
          onClick={onAction}
          className="text-detail text-brand font-semibold active:opacity-70 transition-opacity"
        >
          {action}
        </button>
      )}
    </div>
  );
}
