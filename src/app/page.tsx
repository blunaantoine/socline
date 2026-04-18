'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { ClientApp } from '@/components/client/ClientApp';
import { WasherApp } from '@/components/washer/WasherApp';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { Toaster } from '@/components/ui/sonner';
import { Loader2, Phone, Lock, Eye, EyeOff } from 'lucide-react';

export default function SoclineApp() {
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const { currentView, setView } = useAppStore();
  const [mounted, setMounted] = useState(false);

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
          <img src="/android-chrome-192x192.png" alt="Socline" className="w-28 h-28 mx-auto mb-4 object-contain" />
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
        <LoginScreen onLogin={login} />
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

// Login Screen - Simple with logo and inputs
function LoginScreen({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = async () => {
    setError('');
    
    if (!phone || phone.length < 8) {
      setError('Numéro inval');
      return;
    }
    if (pin.length !== 4) {
      setError('PIN: 4 chiffres requis');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Nom requis');
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
      } else {
        setError(data.error || 'Erreur');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FF9800]">
      {/* Logo Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <img 
          src="/android-chrome-192x192.png" 
          alt="Socline" 
          className="w-32 h-32 mb-4 object-contain" 
        />
        <h1 className="text-3xl font-bold text-white mb-1">Socline</h1>
        <p className="text-white/80 text-sm">Votre lavage auto à domicile</p>
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-t-3xl p-6 pb-8">
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4 text-center">
            {error}
          </div>
        )}

        {mode === 'register' && (
          <input
            type="text"
            placeholder="Nom complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl mb-3 focus:outline-none focus:border-[#FF9800] text-base"
          />
        )}

        <div className="relative mb-3">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <span className="absolute left-11 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+228</span>
          <input
            type="tel"
            placeholder="90 12 34 56"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="w-full pl-20 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9800] text-base"
          />
        </div>

        <div className="relative mb-4">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPin ? 'text' : 'password'}
            placeholder="Code PIN (4 chiffres)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF9800] text-base"
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[#FF9800] text-white py-3.5 rounded-xl font-semibold text-base disabled:opacity-50 mb-3"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>Pas de compte?{' '}
              <button onClick={() => setMode('register')} className="text-[#FF9800] font-semibold">S'inscrire</button>
            </>
          ) : (
            <>Déjà inscrit?{' '}
              <button onClick={() => setMode('login')} className="text-[#FF9800] font-semibold">Se connecter</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
