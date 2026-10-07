'use client';

import { useEffect, useRef } from 'react';

export type RefreshSource = 'initial' | 'interval' | 'focus';

/**
 * Synchronisation automatique des données :
 * - chargement immédiat au montage (et à chaque changement de la callback :
 *   changement d'onglet, de filtre…)
 * - rafraîchissement périodique toutes les `intervalMs`
 * - rafraîchissement au retour sur l'application (onglet redevient visible,
 *   la fenêtre reprend le focus, le réseau revient)
 *
 * `refresh` reçoit la source ('initial' | 'interval' | 'focus') afin de
 * distinguer un chargement visible d'un rafraîchissement silencieux en
 * arrière-plan (pas de spinner qui clignote toutes les 30 s).
 */
export function useAutoRefresh(
  refresh: (source: RefreshSource) => void | Promise<void>,
  intervalMs: number | null = 30000
) {
  const ref = useRef(refresh);

  // Mise à jour de la référence dans un effet (jamais pendant le render)
  useEffect(() => {
    ref.current = refresh;
  }, [refresh]);

  // Chargement immédiat au montage + quand la callback change
  // (changement d'onglet actif, de filtre de recherche, etc.)
  useEffect(() => {
    ref.current('initial');
  }, [refresh]);

  // Intervalle + retour de visibilité / focus / réseau
  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;

    const runInterval = () => {
      ref.current('interval');
    };
    const runFocus = () => {
      ref.current('focus');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runFocus();
    };

    const timer = setInterval(runInterval, intervalMs);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', runFocus);
    window.addEventListener('online', runFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', runFocus);
      window.removeEventListener('online', runFocus);
    };
  }, [intervalMs]);
}
