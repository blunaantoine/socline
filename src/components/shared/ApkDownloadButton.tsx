'use client';

import { Smartphone, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Bouton flottant « Installer l'application » — télécharge l'APK Android.
 *
 * Affiché UNIQUEMENT quand NEXT_PUBLIC_SHOW_APK_DOWNLOAD=1 (environnements
 * de démonstration/sandbox). En production ce composant ne rend rien :
 * le téléchargement y reste accessible via /apk/socline-v1.0-debug.apk.
 */
export function ApkDownloadButton() {
  const enabled = process.env.NEXT_PUBLIC_SHOW_APK_DOWNLOAD === '1';
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  return (
    <a
      href="/apk/socline-v1.0-debug.apk"
      download
      onClick={() => {
        setLoading(true);
        // Laisse le temps au navigateur de démarrer le téléchargement
        setTimeout(() => setLoading(false), 4000);
      }}
      aria-label="Télécharger l'application Android Socline (APK)"
      className="fixed bottom-24 right-3 z-50 flex h-11 items-center gap-2 rounded-full bg-[#FF9800] px-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 active:scale-95 transition-transform"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <Smartphone className="h-5 w-5" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">Installer l&apos;application</span>
    </a>
  );
}
