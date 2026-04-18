'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { AuthModal } from '@/components/socline/AuthModal';
import { Toaster } from '@/components/ui/sonner';

export default function SoclineApp() {
  const { isAuthenticated, user, isLoading, setLoading } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const defaultView = useMemo(() => {
    if (!user) return 'client';
    if (user.role === 'ADMIN') return 'admin';
    if (user.role === 'WASHER') return 'washer';
    return 'client';
  }, [user]);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLoading(false);
      setInitialized(true);
    };
    checkAuth();
  }, [setLoading]);

  useEffect(() => {
    if (initialized && isAuthenticated && user) {
      setView(defaultView);
    }
  }, [initialized, isAuthenticated, user, defaultView, setView]);

  if (isLoading) {
    return (
      <AndroidContainer>
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-[#FFE0B2] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#FF9800] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-[#212121]">Socline</h2>
            <p className="text-[#757575] text-sm">Chargement...</p>
          </div>
        </div>
      </AndroidContainer>
    );
  }

  return (
    <AndroidContainer>
      {!isAuthenticated ? (
        <>
          <LandingScreen onLogin={() => setShowAuth(true)} />
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </>
      ) : (
        <>
          {currentView === 'client' && <ClientApp />}
          {currentView === 'washer' && <WasherApp />}
          {currentView === 'admin' && <AdminPanel />}
        </>
      )}
      <Toaster />
    </AndroidContainer>
  );
}

// Android Container - Full screen Android app style
function AndroidContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {children}
    </div>
  );
}

// Landing Screen - Android Material Design Style
function LandingScreen({ onLogin }: { onLogin: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Lavage à domicile",
      subtitle: "Votre voiture propre sans bouger",
      icon: "🚗",
    },
    {
      title: "Laveurs certifiés",
      subtitle: "Des professionnels de confiance",
      icon: "✅",
    },
    {
      title: "Prix transparents",
      subtitle: "Pas de surprises, payez ce que vous voyez",
      icon: "💰",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          {/* Signal Network Bars -从小到大 (small to large) */}
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-2 bg-white rounded-sm"></div>
            <div className="w-1 h-3 bg-white rounded-sm"></div>
            <div className="w-1 h-4 bg-white rounded-sm"></div>
          </div>
          {/* Battery */}
          <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>

      {/* App Bar */}
      <div className="bg-[#FF9800] px-4 py-4 shadow-md">
        <h1 className="text-white text-xl font-bold">Socline</h1>
        <p className="text-white/80 text-sm">Votre lavage auto, livré à votre porte</p>
      </div>

      {/* Logo Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-24 h-24 bg-[#FF9800] rounded-full flex items-center justify-center mb-6 shadow-lg elevation-4">
          <span className="text-5xl">🚿</span>
        </div>

        {/* Slides */}
        <div className="w-full mb-6">
          <div className="bg-[#FFF8F0] rounded-lg p-6 text-center border border-[#FFE0B2]">
            <span className="text-3xl mb-2 block">{slides[currentSlide].icon}</span>
            <h2 className="text-lg font-bold text-[#212121] mb-1">{slides[currentSlide].title}</h2>
            <p className="text-[#757575] text-sm">{slides[currentSlide].subtitle}</p>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === index ? 'w-6 bg-[#FF9800]' : 'w-2 bg-[#BDBDBD]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">2000+</div>
            <div className="text-xs text-[#757575]">Clients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">30+</div>
            <div className="text-xs text-[#757575]">Laveurs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">4.8</div>
            <div className="text-xs text-[#757575]">Note</div>
          </div>
        </div>
      </div>

      {/* Bottom Buttons - Android Material style */}
      <div className="p-4 space-y-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
        <button
          onClick={onLogin}
          className="w-full bg-[#FF9800] text-white py-3.5 rounded font-semibold text-base elevation-2 active:bg-[#F57C00] transition-colors"
        >
          Commencer
        </button>
        <button
          onClick={onLogin}
          className="w-full border-2 border-[#FF9800] text-[#FF9800] py-3.5 rounded font-semibold text-base bg-transparent active:bg-[#FFF3E0] transition-colors"
        >
          Se connecter
        </button>
      </div>

      {/* Android Navigation Bar */}
      <div className="h-12 bg-black flex items-center justify-center gap-16">
        <button className="w-10 h-10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white rounded-full"></div>
        </button>
        <button className="w-10 h-10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white rounded"></div>
        </button>
        <button className="w-10 h-10 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white rotate-45"></div>
        </button>
      </div>
    </div>
  );
}
