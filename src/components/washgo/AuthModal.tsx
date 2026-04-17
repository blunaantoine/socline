'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, User, Phone, Car, Palette, Lock, Check } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

// Car colors
const carColors = [
  { name: 'Blanc', value: '#FFFFFF', bg: 'bg-white border-2 border-gray-200' },
  { name: 'Noir', value: '#1a1a1a', bg: 'bg-gray-900' },
  { name: 'Gris', value: '#6B7280', bg: 'bg-gray-500' },
  { name: 'Argent', value: '#9CA3AF', bg: 'bg-gray-400' },
  { name: 'Bleu', value: '#3B82F6', bg: 'bg-blue-500' },
  { name: 'Rouge', value: '#EF4444', bg: 'bg-red-500' },
  { name: 'Vert', value: '#22C55E', bg: 'bg-green-500' },
  { name: 'Jaune', value: '#EAB308', bg: 'bg-yellow-500' },
  { name: 'Orange', value: '#F97316', bg: 'bg-orange-500' },
  { name: 'Marron', value: '#92400E', bg: 'bg-amber-800' },
  { name: 'Beige', value: '#D4A574', bg: 'bg-amber-200' },
  { name: 'Violet', value: '#8B5CF6', bg: 'bg-violet-500' },
];

export function AuthModal({ onClose }: AuthModalProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [carColor, setCarColor] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const { login } = useAuthStore();

  const steps = [
    { title: 'Votre nom', icon: User },
    { title: 'Téléphone', icon: Phone },
    { title: 'Votre voiture', icon: Car },
    { title: 'Couleur', icon: Palette },
    { title: 'Code PIN', icon: Lock },
    { title: 'Confirmation', icon: Check },
  ];

  const canGoNext = () => {
    switch (step) {
      case 0: return name.trim().length >= 2;
      case 1: return phone.length >= 8;
      case 2: return plateNumber.trim().length >= 3;
      case 3: return carColor !== '';
      case 4: return pin.every(d => d !== '');
      case 5: return confirmPin.every(d => d !== '') && pin.join('') === confirmPin.join('');
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handlePinChange = (index: number, value: string, isConfirm: boolean = false) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) return;
    
    if (isConfirm) {
      const newPin = [...confirmPin];
      newPin[index] = digits;
      setConfirmPin(newPin);
      if (digits && index < 3) {
        confirmPinRefs.current[index + 1]?.focus();
      }
    } else {
      const newPin = [...pin];
      newPin[index] = digits;
      setPin(newPin);
      if (digits && index < 3) {
        pinRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number, isConfirm: boolean = false) => {
    if (e.key === 'Backspace') {
      const currentPin = isConfirm ? confirmPin : pin;
      if (!currentPin[index] && index > 0) {
        if (isConfirm) {
          confirmPinRefs.current[index - 1]?.focus();
        } else {
          pinRefs.current[index - 1]?.focus();
        }
      }
    }
  };

  const handleRegister = async () => {
    if (pin.join('') !== confirmPin.join('')) {
      toast.error('Les codes PIN ne correspondent pas');
      return;
    }

    setLoading(true);
    
    // Simulate registration
    await new Promise((r) => setTimeout(r, 1000));
    
    const user = {
      id: 'user-' + Date.now(),
      phone: '+228 ' + phone,
      name: name,
      role: 'CLIENT' as const,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vehicle: {
        plateNumber: plateNumber.toUpperCase(),
        color: carColor,
      },
    };
    
    login(user, 'demo-token');
    setLoading(false);
    toast.success('Inscription réussie!');
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 bg-white rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF9800] to-[#F57C00] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={step > 0 ? handleBack : onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === step ? 'w-4 bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
            <div className="w-8" />
          </div>
          <h2 className="text-xl font-bold">{steps[step].title}</h2>
          <p className="text-white/80 text-sm mt-1">
            Étape {step + 1} sur {steps.length}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[280px]">
          {/* Step 0: Name */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <User className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Comment vous appelez-vous ?</h3>
                <p className="text-sm text-[#757575] mt-1">Votre nom sera visible par les laveurs</p>
              </div>
              <Input
                placeholder="Entrez votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-center text-lg rounded-xl border-[#FFE0B2] focus:border-[#FF9800]"
                autoFocus
              />
            </div>
          )}

          {/* Step 1: Phone */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Votre numéro de téléphone</h3>
                <p className="text-sm text-[#757575] mt-1">Pour vous contacter</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center px-4 bg-[#F5F5F5] rounded-xl text-[#757575] font-medium">
                  +228
                </div>
                <Input
                  type="tel"
                  placeholder="90 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="flex-1 h-12 text-center text-lg rounded-xl border-[#FFE0B2] focus:border-[#FF9800]"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Plate Number */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <Car className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Numéro de plaque</h3>
                <p className="text-sm text-[#757575] mt-1">Pour que le laveur retrouve votre voiture</p>
              </div>
              <Input
                placeholder="Ex: TG 1234 A"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                className="h-12 text-center text-lg rounded-xl border-[#FFE0B2] focus:border-[#FF9800] uppercase"
                autoFocus
              />
            </div>
          )}

          {/* Step 3: Car Color */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <Palette className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Couleur de votre voiture</h3>
                <p className="text-sm text-[#757575] mt-1">Sélectionnez la couleur</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {carColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setCarColor(color.name)}
                    className={`aspect-square rounded-xl ${color.bg} flex items-center justify-center transition-all ${
                      carColor === color.name ? 'ring-2 ring-[#FF9800] ring-offset-2' : ''
                    }`}
                  >
                    {carColor === color.name && (
                      <Check className={`w-5 h-5 ${color.name === 'Blanc' || color.name === 'Beige' || color.name === 'Jaune' ? 'text-gray-800' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
              {carColor && (
                <p className="text-center text-sm text-[#757575]">Couleur sélectionnée: <span className="font-medium text-[#212121]">{carColor}</span></p>
              )}
            </div>
          )}

          {/* Step 4: PIN */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Créez votre code PIN</h3>
                <p className="text-sm text-[#757575] mt-1">4 chiffres pour sécuriser votre compte</p>
              </div>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <Input
                    key={index}
                    ref={(el) => { pinRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[index]}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(e, index)}
                    className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-[#FFE0B2] focus:border-[#FF9800]"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Confirm PIN */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-[#FFF3E0] rounded-2xl flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-[#FF9800]" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-[#212121]">Confirmez votre code PIN</h3>
                <p className="text-sm text-[#757575] mt-1">Entrez à nouveau votre code</p>
              </div>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <Input
                    key={index}
                    ref={(el) => { confirmPinRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={confirmPin[index]}
                    onChange={(e) => handlePinChange(index, e.target.value, true)}
                    onKeyDown={(e) => handlePinKeyDown(e, index, true)}
                    className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-[#FFE0B2] focus:border-[#FF9800]"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              {confirmPin.every(d => d !== '') && pin.join('') !== confirmPin.join('') && (
                <p className="text-center text-sm text-red-500">Les codes ne correspondent pas</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <Button
            onClick={handleNext}
            disabled={!canGoNext() || loading}
            className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] rounded-xl font-semibold text-white disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Inscription...
              </span>
            ) : step === steps.length - 1 ? (
              "Terminer"
            ) : (
              <span className="flex items-center gap-2">
                Continuer
                <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
