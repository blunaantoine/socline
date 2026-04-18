'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { AuthModal } from '@/components/washgo/AuthModal';
import { RoleSelector } from '@/components/washgo/RoleSelector';
import { Header } from '@/components/washgo/Header';
import { Toaster } from '@/components/ui/sonner';
import dynamic from 'next/dynamic';

const GoogleMapPreview = dynamic(
  () => import('@/components/map/GoogleMap').then(mod => mod.GoogleMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#F5F5F5] rounded-2xl animate-pulse flex items-center justify-center">
        <div className="text-[#9E9E9E]">Chargement...</div>
      </div>
    )
  }
);

export default function WashGoApp() {
  const { isAuthenticated, user, isLoading, setLoading } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
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
      const timer = setTimeout(() => {
        setShowRoleSelector(true);
        setView(defaultView);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialized, isAuthenticated, user, defaultView, setView]);

  const handleRoleSelect = (view: 'client' | 'washer' | 'admin') => {
    setView(view);
    setShowRoleSelector(false);
  };

  if (isLoading) {
    return (
      <MobileContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-[#FFE0B2] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#FF9800] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-[#212121]">WashGo</h2>
            <p className="text-[#757575] text-sm">Chargement...</p>
          </div>
        </div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {!isAuthenticated ? (
        <>
          <LandingScreen onLogin={() => setShowAuth(true)} />
          {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </>
      ) : (
        <>
          <Header />
          <main className="flex-1 overflow-hidden">
            {currentView === 'client' && <ClientApp />}
            {currentView === 'washer' && <WasherApp />}
            {currentView === 'admin' && <AdminPanel />}
          </main>
          {showRoleSelector && user && user.role === 'ADMIN' && (
            <RoleSelector onSelect={handleRoleSelect} />
          )}
        </>
      )}
      <Toaster />
    </MobileContainer>
  );
}

// Mobile Container - simulates phone screen (full screen mobile app)
function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-[#FFF8F0] rounded-[40px] overflow-hidden shadow-2xl flex flex-col relative border-[8px] border-[#2a2a2a]">
        {children}
      </div>
    </div>
  );
}

// Landing Screen - Mobile Style
function LandingScreen({ onLogin }: { onLogin: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      title: "Lavage à domicile",
      subtitle: "Votre voiture propre sans bouger",
      color: "#FF9800",
    },
    {
      title: "Laveurs certifiés",
      subtitle: "Des professionnels de confiance",
      color: "#4CAF50",
    },
    {
      title: "Prix transparents",
      subtitle: "Pas de surprises, payez ce que vous voyez",
      color: "#2196F3",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Logo Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-[#FF9800] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[#FF9800]/30">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-[#212121] mb-2">WashGo</h1>
        <p className="text-[#757575] text-center mb-8">Votre lavage auto, livré à votre porte</p>

        {/* Slides */}
        <div className="w-full mb-8">
          <div className="bg-[#FFF8F0] rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-[#212121] mb-2">{slides[currentSlide].title}</h2>
            <p className="text-[#757575]">{slides[currentSlide].subtitle}</p>
          </div>
          
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentSlide === index ? 'w-6 bg-[#FF9800]' : 'bg-[#E0E0E0]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">2000+</div>
            <div className="text-xs text-[#757575]">Clients</div>
          </div>
          <div className="w-px bg-[#E0E0E0]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">30+</div>
            <div className="text-xs text-[#757575]">Laveurs</div>
          </div>
          <div className="w-px bg-[#E0E0E0]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-[#FF9800]">4.8</div>
            <div className="text-xs text-[#757575]">Note</div>
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="p-6 space-y-3 bg-white border-t border-[#F5F5F5]">
        <button
          onClick={onLogin}
          className="w-full bg-[#FF9800] text-white py-4 rounded-2xl font-semibold text-lg shadow-lg shadow-[#FF9800]/30 active:scale-[0.98] transition-transform"
        >
          Commencer
        </button>
        <button
          onClick={onLogin}
          className="w-full bg-[#FFF3E0] text-[#FF9800] py-4 rounded-2xl font-semibold text-lg active:scale-[0.98] transition-transform"
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}
