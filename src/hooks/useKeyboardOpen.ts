'use client';

import { useEffect, useState } from 'react';

/**
 * useKeyboardOpen — vrai quand le clavier virtuel est (très probablement) ouvert,
 * c'est-à-dire quand un champ de saisie a le focus sur un écran tactile.
 *
 * Sert à masquer la barre de navigation du bas pendant la saisie : avec
 * `interactive-widget=resizes-content`, la page rétrécit au-dessus du clavier
 * et une barre fixée en bas remonterait collée au clavier, en recouvrant le
 * champ ou le bouton Envoyer.
 *
 * On se fie au focus (fiable sur Android, iOS et la WebView Capacitor) plutôt
 * qu'à la hauteur de l'écran, qui varie selon le navigateur.
 */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]), textarea, [contenteditable="true"]';

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Uniquement sur écran tactile : sur ordinateur, pas de clavier virtuel.
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;

    const update = () => {
      const el = document.activeElement;
      setOpen(!!el && el instanceof HTMLElement && el.matches(EDITABLE));
    };
    // focusout se déclenche avant que le focus suivant soit posé : on attend un tour.
    const onFocusOut = () => setTimeout(update, 0);

    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return open;
}
