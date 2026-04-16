'use client';

import { useState } from 'react';
import { useAuthStore, useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuthStore();

  const handleSendOtp = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }
    
    setLoading(true);
    // Simulate OTP sending
    await new Promise((r) => setTimeout(r, 1000));
    setStep('otp');
    setLoading(false);
    toast.success('Code OTP envoyé!');
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      toast.error('Veuillez entrer le code OTP');
      return;
    }
    
    setLoading(true);
    // Simulate OTP verification
    await new Promise((r) => setTimeout(r, 1000));
    
    // Demo login - in production, this would be an API call
    const user = {
      id: 'demo-user-1',
      phone: phone,
      name: name || 'Utilisateur',
      role: isNewUser ? 'CLIENT' : 'CLIENT',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    login(user, 'demo-token');
    setLoading(false);
    toast.success('Connexion réussie!');
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {step === 'phone' ? 'Connexion' : 'Vérification'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'phone' 
              ? 'Entrez votre numéro de téléphone pour continuer'
              : 'Entrez le code reçu par SMS'}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                  +221
                </span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="77 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="rounded-l-none"
                  maxLength={9}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="newUser"
                checked={isNewUser}
                onChange={(e) => setIsNewUser(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="newUser" className="text-sm font-normal">
                Je suis un nouveau client
              </Label>
            </div>

            {isNewUser && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  placeholder="Votre nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <Button 
              onClick={handleSendOtp} 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Envoi...' : 'Envoyer le code'}
            </Button>

            <p className="text-xs text-center text-gray-500">
              En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Code de vérification</Label>
              <Input
                id="otp"
                type="text"
                placeholder="1234"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                maxLength={6}
              />
            </div>

            <Button 
              onClick={handleVerifyOtp} 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Vérification...' : 'Vérifier'}
            </Button>

            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              Modifier le numéro
            </button>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <p className="text-xs text-center text-gray-500">
            Demo: Entrez n&apos;importe quel numéro et code pour vous connecter
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
