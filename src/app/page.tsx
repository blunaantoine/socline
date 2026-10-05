'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { AuthScreen } from '@/components/client/AuthScreen';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

// Custom hook for client-side hydration without useEffect setState
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function SoclineApp() {
  const { isAuthenticated, user } = useAuthStore();
  const { currentView, setView } = useAppStore();

  // Check if hydrated from localStorage (client-side only)
  const mounted = useHydrated();

  useEffect(() => {
    if (isAuthenticated && user) {
      const view = user.role === 'ADMIN' ? 'admin' : user.role === 'WASHER' ? 'washer' : 'client';
      setView(view);
    }
  }, [isAuthenticated, user, setView]);

  // Show loading screen during hydration
  if (!mounted) {
    return (
      <div className="min-h-dvh bg-[#FF9800] flex items-center justify-center">
        <div className="text-center">
          <img src="/android-chrome-192x192.png" alt="Socline" className="w-28 h-28 mx-auto mb-4 object-contain" />
          <h2 className="text-xl font-bold text-white">Socline</h2>
          <p className="text-white/80 text-sm">Chargement...</p>
          <Loader2 className="w-6 h-6 mx-auto mt-4 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAFAFA] flex flex-col">
      {!isAuthenticated ? (
        <AuthScreen onComplete={() => {}} />
      ) : (
        <>
          {currentView === 'client' && <ClientApp />}
          {currentView === 'washer' && <WasherApp />}
          {currentView === 'admin' && <AdminPanel />}
        </>
      )}
      <Toaster />
    </div>
  );
}
