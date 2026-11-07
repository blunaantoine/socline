'use client';

import { Plus, Wallet } from 'lucide-react';
import { HideableBalanceDark } from '@/components/ui/hideable-balance';

/**
 * WalletSummaryCard — solde du portefeuille en un coup d'œil sur l'Accueil
 * (carte navy, solde masquable, bouton « Recharger »).
 */
export function WalletSummaryCard({
  balance,
  onOpen,
  onTopUp,
}: {
  balance: number;
  /** Ouvre l'onglet Portefeuille (toucher la carte). */
  onOpen: () => void;
  /** Ouvre l'onglet Portefeuille pour recharger. */
  onTopUp: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-ink to-ink-2 p-4 text-white">
      <div aria-hidden="true" className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/[0.06]" />
      <div className="relative flex items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="flex items-center gap-1.5 text-detail text-white/70">
            <Wallet className="w-4 h-4" /> Portefeuille Socline
          </span>
        </button>
        <button
          type="button"
          onClick={onTopUp}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-brand-ink text-white rounded-pill px-3.5 py-2 text-detail font-bold active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.6} />
          Recharger
        </button>
      </div>
      <HideableBalanceDark balance={balance} size="xl" className="relative mt-1" storageKey="hide-balance" />
    </div>
  );
}
