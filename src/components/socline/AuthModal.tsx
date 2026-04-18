'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { X, User, Phone, Car, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
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

export function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
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

    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, plateNumber, carColor, pin }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user, data.token);
        toast.success('Inscription réussie!');
        onClose();
      } else {
        setError(data.error || 'Erreur lors de l\'inscription');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
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

    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user, data.token);
        toast.success('Connexion réussie!');
        onClose();
      } else {
        setError(data.error || 'Identifiants incorrects');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 bg-white rounded-3xl overflow-hidden border-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">
            {mode === 'login' ? 'Connexion' : 'Inscription'}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {mode === 'login' ? 'Entrez vos identifiants' : 'Créez votre compte en quelques secondes'}
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Name - Only for register */}
          {mode === 'register' && (
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
          )}

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Téléphone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[#757575] text-sm">+228</span>
              <Input
                type="tel"
                placeholder="90 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="pl-20 h-12 bg-[#F5F5F5] border-0 rounded-xl"
              />
            </div>
          </div>

          {/* Plate Number & Car Color - Only for register */}
          {mode === 'register' && (
            <>
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#757575]">Couleur de la voiture</label>
                <div className="grid grid-cols-5 gap-2">
                  {CAR_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setCarColor(color.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        carColor === color.id 
                          ? 'bg-[#FFF3E0] ring-2 ring-[#FF9800]' 
                          : 'bg-[#F5F5F5]'
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
            </>
          )}

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
            {mode === 'register' && (
              <p className="text-xs text-[#9E9E9E]">Ce PIN servira à vous connecter</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === 'login' ? (
              'Se connecter'
            ) : (
              'Créer mon compte'
            )}
          </Button>

          {/* Switch Mode */}
          <p className="text-center text-sm text-[#757575]">
            {mode === 'login' ? (
              <>
                Pas encore de compte?{' '}
                <button onClick={() => setMode('register')} className="text-[#FF9800] font-semibold">
                  S'inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte?{' '}
                <button onClick={() => setMode('login')} className="text-[#FF9800] font-semibold">
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
