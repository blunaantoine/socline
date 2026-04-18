'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Car, Phone, User, Lock, Palette, ArrowLeft, 
  Eye, EyeOff, CheckCircle, Loader2, AlertCircle 
} from 'lucide-react';
import { useAuthStore } from '@/store';

interface AuthScreenProps {
  onComplete: () => void;
}

const CAR_COLORS = [
  { id: 'Noir', label: 'Noir', color: '#1a1a1a' },
  { id: 'Blanc', label: 'Blanc', color: '#ffffff' },
  { id: 'Gris', label: 'Gris', color: '#6b7280' },
  { id: 'Argent', label: 'Argent', color: '#9ca3af' },
  { id: 'Bleu', label: 'Bleu', color: '#3b82f6' },
  { id: 'Rouge', label: 'Rouge', color: '#ef4444' },
  { id: 'Vert', label: 'Vert', color: '#22c55e' },
  { id: 'Marron', label: 'Marron', color: '#78350f' },
  { id: 'Beige', label: 'Beige', color: '#d4b896' },
  { id: 'Jaune', label: 'Jaune', color: '#eab308' },
];

export function AuthScreen({ onComplete }: AuthScreenProps) {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [carColor, setCarColor] = useState('');
  const [pin, setPin] = useState('');
  
  const { login } = useAuthStore();

  const handleRegister = async () => {
    setError(null);
    
    if (!name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setError('Numéro de téléphone inval');
      return;
    }
    if (!plateNumber.trim()) {
      setError('Veuillez entrer le numéro de plaque');
      return;
    }
    if (!carColor) {
      setError('Veuillez sélectionner la couleur de votre voiture');
      return;
    }
    if (pin.length !== 4) {
      setError('Le PIN doit contenir 4 chiffres');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, plateNumber, carColor, pin }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user, data.token);
        onComplete();
      } else {
        setError(data.error || 'Erreur lors de l\'inscription');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    
    if (!phone.trim() || phone.length < 8) {
      setError('Numéro de téléphone inval');
      return;
    }
    if (pin.length !== 4) {
      setError('PIN invalide');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user, data.token);
        onComplete();
      } else {
        setError(data.error || 'Erreur de connexion');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  // Welcome Screen
  if (mode === 'welcome') {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#FF9800] to-[#F57C00]">
        {/* Logo Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
            <Car className="w-12 h-12 text-[#FF9800]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Socline</h1>
          <p className="text-white/80 text-center">Votre lavage auto à domicile</p>
        </div>
        
        {/* Buttons */}
        <div className="p-6 space-y-3">
          <Button
            onClick={() => setMode('login')}
            className="w-full h-14 bg-white text-[#FF9800] hover:bg-white/90 rounded-2xl font-semibold text-lg"
          >
            Se connecter
          </Button>
          <Button
            onClick={() => setMode('register')}
            variant="outline"
            className="w-full h-14 border-2 border-white text-white hover:bg-white/10 rounded-2xl font-semibold text-lg"
          >
            Créer un compte
          </Button>
        </div>
      </div>
    );
  }

  // Login Screen
  if (mode === 'login') {
    return (
      <div className="flex-1 flex flex-col bg-[#FFF8F0]">
        {/* Header */}
        <div className="bg-[#FF9800] p-4 pt-8 pb-12 rounded-b-3xl">
          <button onClick={() => setMode('welcome')} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Connexion</h1>
          <p className="text-white/80 mt-1">Entrez vos identifiants</p>
        </div>

        {/* Form */}
        <div className="flex-1 p-6 -mt-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Numéro de téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  type="tel"
                  placeholder="90 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Code PIN (4 chiffres)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  type={showPin ? 'text' : 'password'}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="pl-10 pr-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Se connecter'
              )}
            </Button>
          </div>

          <p className="text-center mt-4 text-[#757575]">
            Pas encore de compte?{' '}
            <button onClick={() => setMode('register')} className="text-[#FF9800] font-semibold">
              S'inscrire
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Register Screen
  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0]">
      {/* Header */}
      <div className="bg-[#FF9800] p-4 pt-8 pb-12 rounded-b-3xl">
        <button onClick={() => setMode('welcome')} className="text-white mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Inscription</h1>
        <p className="text-white/80 mt-1">Créez votre compte en quelques étapes</p>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Nom complet</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <Input
                type="text"
                placeholder="Kofi Mensah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Numéro de téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[#757575]">+228</span>
              <Input
                type="tel"
                placeholder="90 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="pl-20 h-12 bg-[#F5F5F5] border-0 rounded-xl"
              />
            </div>
          </div>

          {/* Plate Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Numéro de plaque</label>
            <div className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <Input
                type="text"
                placeholder="TG 1234 A"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl uppercase"
              />
            </div>
          </div>

          {/* Car Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575] flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Couleur de la voiture
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CAR_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setCarColor(color.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    carColor === color.id 
                      ? 'bg-[#FFF3E0] ring-2 ring-[#FF9800]' 
                      : 'bg-[#F5F5F5] hover:bg-[#EEEEEE]'
                  }`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full border-2 ${
                      color.id === 'Blanc' ? 'border-gray-300' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.color }}
                  />
                  <span className="text-[10px] text-[#757575]">{color.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Code PIN (4 chiffres)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <Input
                type={showPin ? 'text' : 'password'}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="pl-10 pr-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-[#9E9E9E]">Ce PIN sera utilisé pour vous connecter</p>
          </div>

          <Button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Créer mon compte
              </>
            )}
          </Button>
        </div>

        <p className="text-center mt-4 text-[#757575]">
          Déjà un compte?{' '}
          <button onClick={() => setMode('login')} className="text-[#FF9800] font-semibold">
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
}
