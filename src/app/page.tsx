'use client';

import { useEffect, useState } from 'react';

export default function SoclineApp() {
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear corrupted data on mount
  useEffect(() => {
    try {
      // Remove all old auth data
      localStorage.removeItem('washgo-auth');
      localStorage.removeItem('socline-auth');
    } catch (e) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setError('Erreur de stockage navigateur');
      }, 0);
      console.error('Storage error:', e);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#FF9800] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 text-center max-w-sm">
          <h2 className="text-lg font-bold text-red-500 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="bg-[#FF9800] text-white px-6 py-2 rounded font-semibold"
          >
            Effacer les données
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <LandingScreen onLogin={() => setShowAuth(true)} />
      {showAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-center">Connexion</h2>
            <p className="text-center text-gray-500">Mode simplifié - cliquez pour continuer</p>
            <button
              onClick={() => {
                // Create a simple user
                const user = {
                  id: 'user-1',
                  name: 'Utilisateur Test',
                  phone: '90123456',
                  role: 'CLIENT',
                  balance: 0,
                  createdAt: new Date().toISOString(),
                };
                localStorage.setItem('socline-auth', JSON.stringify({
                  state: { user, token: 'test-token', isAuthenticated: true }
                }));
                window.location.reload();
              }}
              className="w-full mt-4 bg-[#FF9800] text-white py-3 rounded-xl font-semibold"
            >
              Continuer en tant que Client
            </button>
            <button
              onClick={() => setShowAuth(false)}
              className="w-full mt-2 text-gray-500 py-2"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Landing Screen - Android Material Design Style
function LandingScreen({ onLogin }: { onLogin: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { title: "Lavage à domicile", subtitle: "Votre voiture propre sans bouger", icon: "🚗" },
    { title: "Laveurs certifiés", subtitle: "Des professionnels de confiance", icon: "✅" },
    { title: "Prix transparents", subtitle: "Pas de surprises, payez ce que vous voyez", icon: "💰" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Android Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-1 bg-white rounded-sm"></div>
            <div className="w-1 h-2 bg-white rounded-sm"></div>
            <div className="w-1 h-3 bg-white rounded-sm"></div>
            <div className="w-1 h-4 bg-white rounded-sm"></div>
          </div>
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
        <div className="w-24 h-24 bg-[#FF9800] rounded-full flex items-center justify-center mb-6 shadow-lg">
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

      {/* Bottom Buttons */}
      <div className="p-4 space-y-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
        <button
          onClick={onLogin}
          className="w-full bg-[#FF9800] text-white py-3.5 rounded font-semibold text-base active:bg-[#F57C00] transition-colors"
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
