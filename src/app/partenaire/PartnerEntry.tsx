'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store';
import { AuthScreen } from '@/components/client/AuthScreen';

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * Ouvre l'écran « Devenir Laveur » d'AuthScreen. Un utilisateur déjà connecté
 * (ou qui vient de finir son inscription) est renvoyé vers l'application.
 */
export function PartnerEntry() {
  const router = useRouter();
  const mounted = useHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (mounted && isAuthenticated) router.replace('/');
  }, [mounted, isAuthenticated, router]);

  if (!mounted || isAuthenticated) {
    return (
      <div className="min-h-dvh bg-[#FF9800] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAFAFA] flex flex-col">
      <AuthScreen onComplete={() => {}} initialMode="washer-info" />
    </div>
  );
}
