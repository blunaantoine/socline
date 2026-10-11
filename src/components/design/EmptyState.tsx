'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * EmptyState — état vide : petite illustration (icône dans une zone
 * teintée), phrase courte, action facultative.
 */
export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  tint = 'bg-brand-soft',
  iconColor = 'text-brand',
}: {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
  iconColor?: string;
}) {
  return (
    <div className="w-full bg-surface rounded-card border border-line py-8 px-4 flex flex-col items-center text-center">
      <div className={`w-14 h-14 rounded-card ${tint} grid place-items-center mb-3`}>
        <Icon className={`w-7 h-7 ${iconColor}`} strokeWidth={1.8} />
      </div>
      <p className="text-body text-soft mb-3">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-ink hover:bg-ink-2 text-white rounded-btn px-4 py-2.5 text-detail font-bold active:scale-95 transition-transform min-h-[44px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
