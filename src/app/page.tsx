'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { Toaster } from '@/components/ui/sonner';
import { Car, Shield, Coins, ChevronRight, Loader2, User, Phone, Lock, Eye, EyeOff } from 'lucide-react';

export default function SoclineApp() {
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    localStorage.removeItem('washgo-auth');
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && mounted) {
      const view = user.role === 'ADMIN' ? 'admin' : user.role === 'WASHER' ? 'washer' : 'client';
      setView(view);
    }
  }, [isAuthenticated, user, mounted, setView]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#FF9800] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/android-chrome-192x192.png" alt="Socline" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold text-white">Socline</h2>
          <p className="text-white/80 text-sm">Chargement...</p>
          <Loader2 className="w-6 h-6 mx-auto mt-4 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {!isAuthenticated ? (
        <>
          <LandingScreen onLogin={() => setShowAuth(true)} />
          {showAuth && (
            <AuthModal 
              mode={authMode}
              onLogin={login}
              onClose={() => setShowAuth(false)} 
              onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            />
          )}
        </>
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

// Landing Screen
function LandingScreen({ onLogin }: { onLogin: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { title: "Lavage à domicile", subtitle: "Votre voiture propre sans bouger", icon: Car },
    { title: "Laveurs certifiés", subtitle: "Des professionnels de confiance", icon: Shield },
    { title: "Prix transparents", subtitle: "Pas de surprises, payez ce que vous voyez", icon: Coins },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const IconComponent = slides[currentSlide].icon;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Status Bar */}
      <div className="h-6 bg-[#FF9800] flex items-center justify-between px-4">
        <span className="text-white text-xs font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <div className="flex items-end gap-0.5">
            {[1,2,3,4].map((h) => (
              <div key={h} className="w-1 bg-white rounded-sm" style={{ height: h * 4 }} />
            ))}
          </div>
          <div className="w-5 h-2.5 border border-white rounded-sm ml-1 relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{ width: '70%' }} />
          </div>
        </div>
      </div>

      {/* App Bar */}
      <div className="bg-[#FF9800] px-4 py-4 shadow-md">
        <h1 className="text-white text-xl font-bold">Socline</h1>
        <p className="text-white/80 text-sm">Votre lavage auto, livré à votre porte</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="w-24 h-24 bg-[#FF9800] rounded-full flex items-center justify-center mb-6 shadow-lg overflow-hidden">
          <img src="/android-chrome-192x192.png" alt="Socline" className="w-full h-full object-cover" />
        </div>

        {/* Slides */}
        <div className="w-full mb-6">
          <div className="bg-[#FFF8F0] rounded-lg p-6 text-center border border-[#FFE0B2]">
            <div className="w-12 h-12 mx-auto mb-3 bg-[#FF9800] rounded-full flex items-center justify-center">
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-[#212121] mb-1">{slides[currentSlide].title}</h2>
            <p className="text-[#757575] text-sm">{slides[currentSlide].subtitle}</p>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${currentSlide === index ? 'w-6 bg-[#FF9800]' : 'w-2 bg-[#BDBDBD]'}`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8 mb-6">
          {[
            { value: '2000+', label: 'Clients' },
            { value: '30+', label: 'Laveurs' },
            { value: '4.8', label: 'Note' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-[#FF9800]">{stat.value}</div>
              <div className="text-xs text-[#757575]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="p-4 space-y-3 bg-[#FAFAFA] border-t border-[#E0E0E0]">
        <button onClick={onLogin} className="w-full bg-[#FF9800] text-white py-3.5 rounded-lg font-semibold active:bg-[#F57C00]">
          Commencer
        </button>
        <button onClick={onLogin} className="w-full border-2 border-[#FF9800] text-[#FF9800] py-3.5 rounded-lg font-semibold bg-transparent active:bg-[#FFF3E0]">
          Se connecter
        </button>
      </div>

      {/* Android Nav */}
      <div className="h-12 bg-black flex items-center justify-center gap-16">
        <div className="w-5 h-5 border-2 border-white rounded-full" />
        <div className="w-5 h-5 border-2 border-white rounded" />
        <div className="w-4 h-4 border-2 border-white rotate-45" />
      </div>
    </div>
  );
}

// Auth Modal
function AuthModal({ mode, onLogin, onClose, onSwitchMode }: { 
  mode: 'login' | 'register'; 
  onLogin: (user: any, token: string) => void;
  onClose: () => void; 
  onSwitchMode: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = async () => {
    setError('');
    
    if (!phone || phone.length < 8) {
      setError('Numéro de téléphone invalide');
      return;
    }
    if (pin.length !== 4) {
      setError('Le PIN doit contenir 4 chiffres');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }

    setLoading(true);
    
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' 
        ? { phone, pin }
        : { name, phone, pin, plateNumber: 'TG 0000 A', carColor: 'Noir' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (data.success) {
        onLogin(data.user, data.token);
        onClose();
      } else {
        setError(data.error || 'Erreur lors de la connexion');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-5 text-white">
          <h2 className="text-xl font-bold">{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>
          <p className="text-white/80 text-sm mt-1">
            {mode === 'login' ? 'Entrez vos identifiants' : 'Créez votre compte'}
          </p>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">{error}</div>
          )}
          
          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9800]"
              />
            </div>
          )}

          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+228</span>
            <input
              type="tel"
              placeholder="90 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full pl-20 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9800]"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPin ? 'text' : 'password'}
              placeholder="Code PIN (4 chiffres)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9800]"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#FF9800] text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>

          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>Pas encore de compte?{' '}
                <button onClick={onSwitchMode} className="text-[#FF9800] font-semibold">S'inscrire</button>
              </>
            ) : (
              <>Déjà un compte?{' '}
                <button onClick={onSwitchMode} className="text-[#FF9800] font-semibold">Se connecter</button>
              </>
            )}
          </p>
        </div>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white/80">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
      </div>
    </div>
  );
}
