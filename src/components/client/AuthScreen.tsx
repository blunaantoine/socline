'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Car, Phone, User, Lock, Palette, ArrowLeft, 
  Eye, EyeOff, CheckCircle, Loader2, AlertCircle,
  FileText, Download, IdCard, CreditCard, ChevronRight,
  MapPin, Building, Info, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '@/store';

type WasherType = 'INDEPENDENT' | 'STATION_OWNER';

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

// Washer Registration Info Component
function WasherRegistrationInfo({ onBack }: { onBack: () => void }) {
  // Contrat de Partenariat SOCLINE (Article 5) — barème de rémunération progressive
  const partnerLevels = [
    { level: 1, name: 'Départ', share: '60 %', conditions: 'Dès la signature du contrat' },
    { level: 2, name: 'Confirmé', share: '65 %', conditions: '30 prestations, note ≥ 4,0/5' },
    { level: 3, name: 'Expert', share: '70 %', conditions: '80 prestations, note ≥ 4,3/5, < 10 % annulations' },
    { level: 4, name: 'Référent', share: '75 %', conditions: '150 prestations, note ≥ 4,5/5, < 7 % annulations' },
    { level: 5, name: 'Excellence', share: '80 %', conditions: '300 prestations, note ≥ 4,7/5, < 5 % annulations' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0]">
      {/* Header */}
      <div className="bg-[#4CAF50] p-4 pt-8 pb-12 rounded-b-3xl">
        <button onClick={onBack} className="text-white mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Devenir Laveur</h1>
        <p className="text-white/80 mt-1">Rejoignez notre équipe de partenaires</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {/* Intro */}
          <div className="text-center py-4 border-b border-[#F5F5F5]">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-3">
              <Car className="w-8 h-8 text-[#4CAF50]" />
            </div>
            <h2 className="font-bold text-[#212121] text-lg">Avantages du partenaire</h2>
            <ul className="text-sm text-[#757575] mt-2 space-y-1">
              <li>✓ Revenus progressifs : de 60 % jusqu&apos;à 80 % par prestation</li>
              <li>✓ Horaires libres, vous choisissez vos missions</li>
              <li>✓ Paiements chaque semaine</li>
              <li>✓ Récapitulatif clair de vos gains dans l&apos;Application</li>
            </ul>
          </div>

          {/* Documents Required (Contrat Article 8) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#212121] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#4CAF50]" />
              Pièces à fournir (Article 8)
            </h3>
            
            <div className="bg-[#F5F5F5] rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center flex-shrink-0">
                  <IdCard className="w-5 h-5 text-[#2196F3]" />
                </div>
                <div>
                  <p className="font-medium text-[#212121]">Carte d&apos;identité nationale OU carte d&apos;électeur</p>
                  <p className="text-sm text-[#757575]">Copie en cours de validité</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-[#FF9800]" />
                </div>
                <div>
                  <p className="font-medium text-[#212121]">Photo d&apos;identité récente</p>
                  <p className="text-sm text-[#757575]">À coller en page 1 du contrat</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#4CAF50]" />
                </div>
                <div>
                  <p className="font-medium text-[#212121]">Extrait de casier judiciaire</p>
                  <p className="text-sm text-[#757575]">Bulletin n° 3, de moins de 3 mois</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#F3E5F5] rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-[#9C27B0]" />
                </div>
                <div>
                  <p className="font-medium text-[#212121]">Contrat signé et paraphé</p>
                  <p className="text-sm text-[#757575]">Signature sur chaque page</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contract */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#212121] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#4CAF50]" />
              Contrat de partenariat
            </h3>
            
            <div className="bg-[#E8F5E9] rounded-xl p-4">
              <p className="text-sm text-[#757575] mb-3">
                Téléchargez le contrat officiel (PDF, 3 pages), remplissez-le en lettres majuscules,
                collez votre photo d&apos;identité, signez-le et envoyez-le avec vos documents.
              </p>
              <a
                href="/documents/Contrat_Partenaire_SOCLINE_a_imprimer.pdf"
                download="Contrat_Partenaire_SOCLINE_a_imprimer.pdf"
                className="w-full bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-md py-2.5 flex items-center justify-center text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger le contrat (PDF)
              </a>
            </div>
          </div>

          {/* Progressive remuneration (Contrat Article 5) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#212121] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF9800]" />
              Rémunération progressive
            </h3>
            <p className="text-xs text-[#757575] -mt-1">
              Votre part augmente avec votre régularité et la qualité de votre travail,
              selon le barème du contrat (Article 5). Le niveau est réévalué
              automatiquement par l&apos;Application.
            </p>
            <div className="rounded-xl overflow-hidden border border-[#E0E0E0]">
              {partnerLevels.map((lvl, idx) => (
                <div
                  key={lvl.level}
                  className={`flex items-center gap-3 p-3 ${idx % 2 === 0 ? 'bg-[#FFF8F0]' : 'bg-white'} ${idx !== partnerLevels.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF9800] to-[#F57C00] text-white flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[9px] leading-none opacity-90">Niv.</span>
                    <span className="text-sm font-bold leading-none">{lvl.level}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#212121] text-sm">{lvl.name}</p>
                    <p className="text-[11px] text-[#757575] leading-tight">{lvl.conditions}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#4CAF50] text-base leading-none">{lvl.share}</p>
                    <p className="text-[9px] text-[#9E9E9E] mt-0.5">partenaire</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#FFF3E0] border border-[#FFCC80] rounded-xl p-3">
              <p className="text-xs text-[#E65100] flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Paiements chaque semaine pour les prestations de la semaine précédente.
                  Relevé détaillé disponible dans l&apos;Application ; toute contestation
                  doit être signalée dans les 7 jours.
                </span>
              </p>
            </div>
          </div>

          {/* Process */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#212121]">Processus d&apos;inscription</h3>
            
            <div className="space-y-2">
              {[
                { step: 1, title: 'Télécharger le contrat (PDF)', desc: 'Bouton ci-dessus — 3 pages à imprimer' },
                { step: 2, title: 'Remplir en MAJUSCULES et signer', desc: 'Coller la photo en page 1, paraphe chaque page' },
                { step: 3, title: 'Préparer vos pièces (Article 8)', desc: 'CNI ou carte d\'électeur, photo, casier judiciaire (n° 3)' },
                { step: 4, title: 'Contacter le support', desc: '+228 71 99 81 55 (WhatsApp)' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#4CAF50] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-[#212121] text-sm">{item.title}</p>
                    <p className="text-xs text-[#757575]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-[#4CAF50] to-[#43A047] rounded-xl p-4 text-white">
            <p className="font-semibold">Besoin d&apos;aide ?</p>
            <p className="text-sm opacity-90 mt-1">Contactez notre équipe support</p>
            <div className="flex gap-2 mt-3">
              <a
                href="tel:+22871998155"
                className="flex-1 bg-white text-[#4CAF50] rounded-lg py-2 text-center font-medium text-sm"
              >
                Appeler
              </a>
              <a
                href="https://wa.me/22871998155?text=Bonjour, je souhaite devenir laveur sur Socline"
                className="flex-1 bg-[#25D366] text-white rounded-lg py-2 text-center font-medium text-sm"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthScreen({ onComplete }: AuthScreenProps) {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register' | 'verify-otp' | 'washer-info' | 'washer-type' | 'register-independent' | 'register-station'>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [carColor, setCarColor] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  // Washer registration fields
  const [washerType, setWasherType] = useState<WasherType | null>(null);
  const [stationName, setStationName] = useState('');
  const [stationAddress, setStationAddress] = useState('');
  const [stationPhone, setStationPhone] = useState('');
  const [stationDescription, setStationDescription] = useState('');
  
  // Helper: returns true when the current registration flow is for a washer
  const isWasherRegistration = washerType !== null;
  // Helper: returns the register mode to return to from verify-otp based on washerType
  const getRegisterMode = (): 'register' | 'register-independent' | 'register-station' => {
    if (washerType === 'INDEPENDENT') return 'register-independent';
    if (washerType === 'STATION_OWNER') return 'register-station';
    return 'register';
  };
  
  // OTP fields
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const { login } = useAuthStore();

  // Timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Send OTP for registration
  const handleSendOtp = async () => {
    setError(null);
    
    if (!name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setError('Numéro de téléphone inval');
      return;
    }
    // Plate number and car color only required for client registration
    if (!isWasherRegistration) {
      if (!plateNumber.trim()) {
        setError('Veuillez entrer le numéro de plaque');
        return;
      }
      if (!carColor) {
        setError('Veuillez sélectionner la couleur de votre voiture');
        return;
      }
    }
    // Station owners must provide station name and address
    if (washerType === 'STATION_OWNER') {
      if (!stationName.trim()) {
        setError('Veuillez entrer le nom de la station');
        return;
      }
      if (!stationAddress.trim()) {
        setError('Veuillez entrer l\'adresse de la station');
        return;
      }
    }
    if (pin.length !== 4) {
      setError('Le PIN doit contenir 4 chiffres');
      return;
    }
    if (confirmPin.length !== 4) {
      setError('Veuillez confirmer votre PIN');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      
      if (!res.ok) {
        setError('Erreur du serveur. Réessayez.');
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setError('Réponse invalide du serveur');
        return;
      }
      const data = await res.json();
      
      if (data.success) {
        setSentOtp(data.otp || '123456');
        setMode('verify-otp');
        setResendTimer(60);
      } else {
        setError(data.error || 'Erreur lors de l\'envoi du code');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP and complete registration
  const handleVerifyOtp = async () => {
    setError(null);
    
    if (otp.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }

    setIsLoading(true);
    try {
      // Send OTP along with registration data for verification.
      // Include washerType and station fields when registering as a washer.
      const requestBody: Record<string, string> = { name, phone, pin, otp };
      if (isWasherRegistration && washerType) {
        requestBody.washerType = washerType;
        if (washerType === 'STATION_OWNER') {
          requestBody.stationName = stationName;
          requestBody.stationAddress = stationAddress;
          // stationPhone defaults to user phone if not provided
          requestBody.stationPhone = stationPhone.trim() || phone;
          requestBody.stationDescription = stationDescription;
        }
      } else {
        requestBody.plateNumber = plateNumber;
        requestBody.carColor = carColor;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!res.ok) {
        setError('Erreur du serveur. Réessayez.');
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setError('Réponse invalide du serveur');
        return;
      }
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
      
      if (!res.ok) {
        setError('Erreur du serveur. Réessayez.');
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setError('Réponse invalide du serveur');
        return;
      }
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

  // Reset washer-specific state when leaving the washer registration flow.
  // This ensures washerType is cleared when the user starts a client
  // registration or navigates back to welcome/login.
  useEffect(() => {
    if (mode === 'welcome' || mode === 'register' || mode === 'login') {
      setWasherType(null);
    }
  }, [mode]);

  // Washer Info Screen
  if (mode === 'washer-info') {
    return <WasherRegistrationInfo onBack={() => setMode('washer-type')} />;
  }

  // Washer Type Selection Screen
  if (mode === 'washer-type') {
    return (
      <div className="flex-1 flex flex-col bg-[#FFF8F0]">
        {/* Header */}
        <div className="bg-[#FF9800] p-4 pt-8 pb-12 rounded-b-3xl">
          <button onClick={() => setMode('welcome')} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Devenir Laveur</h1>
          <p className="text-white/80 mt-1">Choisissez votre type d&apos;activité</p>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-8">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#212121] text-center">
              Quel type de laveur êtes-vous?
            </h2>

            {/* Independent Washer Card */}
            <button
              type="button"
              onClick={() => {
                setWasherType('INDEPENDENT');
                setError(null);
                setMode('register-independent');
              }}
              className="w-full text-left bg-[#FFF8F0] hover:bg-[#FFF3E0] border-2 border-transparent hover:border-[#FF9800] rounded-2xl p-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#FF9800] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#212121] text-base">Laveur Indépendant</h3>
                  <p className="text-sm text-[#757575] mt-1">
                    Je me déplace chez les clients. Tarifs définis par l&apos;application.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#9E9E9E] mt-1" />
              </div>
            </button>

            {/* Station Owner Card */}
            <button
              type="button"
              onClick={() => {
                setWasherType('STATION_OWNER');
                setError(null);
                setMode('register-station');
              }}
              className="w-full text-left bg-[#FFF8F0] hover:bg-[#FFF3E0] border-2 border-transparent hover:border-[#FF9800] rounded-2xl p-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#FF9800] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#212121] text-base">Station de Lavage</h3>
                  <p className="text-sm text-[#757575] mt-1">
                    J&apos;ai une station physique. Je crée mes propres offres et tarifs.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#9E9E9E] mt-1" />
              </div>
            </button>

            {/* Info Link */}
            <button
              onClick={() => setMode('washer-info')}
              className="w-full text-center text-[#FF9800] text-sm hover:text-[#F57C00] transition-colors mt-2 py-2 flex items-center justify-center gap-1"
            >
              <Info className="w-4 h-4" />
              En savoir plus sur le partenariat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Washer Registration Screen (INDEPENDENT or STATION_OWNER)
  if (mode === 'register-independent' || mode === 'register-station') {
    const isStation = mode === 'register-station';
    return (
      <div className="flex-1 flex flex-col bg-[#FFF8F0]">
        {/* Header */}
        <div className="bg-[#FF9800] p-4 pt-8 pb-12 rounded-b-3xl">
          <button onClick={() => setMode('washer-type')} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isStation ? 'Inscription Station' : 'Inscription Laveur'}
          </h1>
          <p className="text-white/80 mt-1">
            {isStation
              ? 'Créez votre compte de station de lavage'
              : 'Créez votre compte de laveur indépendant'}
          </p>
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

            {/* Washer Type Badge */}
            <div className="flex items-center gap-2 bg-[#FFF3E0] rounded-xl p-3">
              {isStation ? (
                <Building className="w-5 h-5 text-[#FF9800]" />
              ) : (
                <Car className="w-5 h-5 text-[#FF9800]" />
              )}
              <span className="text-sm font-medium text-[#757575]">
                {isStation ? 'Station de Lavage' : 'Laveur Indépendant'}
              </span>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="washer-name">Nom complet</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  id="washer-name"
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
              <Label htmlFor="washer-phone">Numéro de téléphone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[#757575]">+228</span>
                <Input
                  id="washer-phone"
                  type="tel"
                  placeholder="90 12 34 56"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="pl-20 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                />
              </div>
            </div>

            {/* Station fields - only for STATION_OWNER */}
            {isStation && (
              <>
                <div className="border-t border-[#F5F5F5] pt-4">
                  <h3 className="font-semibold text-[#212121] text-sm mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#FF9800]" />
                    Informations de la station
                  </h3>
                </div>

                {/* Station Name */}
                <div className="space-y-2">
                  <Label htmlFor="station-name">Nom de la station *</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                    <Input
                      id="station-name"
                      type="text"
                      placeholder="Station Lavage Express"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                    />
                  </div>
                </div>

                {/* Station Address */}
                <div className="space-y-2">
                  <Label htmlFor="station-address">Adresse de la station *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                    <Input
                      id="station-address"
                      type="text"
                      placeholder="Rue, quartier, ville"
                      value={stationAddress}
                      onChange={(e) => setStationAddress(e.target.value)}
                      className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                    />
                  </div>
                </div>

                {/* Station Phone */}
                <div className="space-y-2">
                  <Label htmlFor="station-phone">Téléphone de la station (optionnel)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                    <Input
                      id="station-phone"
                      type="tel"
                      placeholder="Par défaut: votre numéro"
                      value={stationPhone}
                      onChange={(e) => setStationPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="pl-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-[#9E9E9E]">
                    Laissez vide pour utiliser votre numéro personnel
                  </p>
                </div>

                {/* Station Description */}
                <div className="space-y-2">
                  <Label htmlFor="station-desc">Description (optionnel)</Label>
                  <Textarea
                    id="station-desc"
                    placeholder="Services proposés, horaires d'ouverture, équipements..."
                    value={stationDescription}
                    onChange={(e) => setStationDescription(e.target.value)}
                    className="bg-[#F5F5F5] border-0 rounded-xl min-h-20"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* PIN */}
            <div className="space-y-2">
              <Label htmlFor="washer-pin">Code PIN (4 chiffres)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  id="washer-pin"
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

            {/* Confirm PIN */}
            <div className="space-y-2">
              <Label htmlFor="washer-confirm-pin">Confirmer le code PIN</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  id="washer-confirm-pin"
                  type={showConfirmPin ? 'text' : 'password'}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="pl-10 pr-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
                >
                  {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPin.length > 0 && pin === confirmPin && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Les codes correspondent
                </p>
              )}
            </div>

            <Button
              onClick={handleSendOtp}
              disabled={isLoading}
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Continuer
                </>
              )}
            </Button>
          </div>

          <p className="text-center mt-4 text-[#757575]">
            <button onClick={() => setMode('washer-type')} className="text-[#FF9800] font-semibold">
              Changer de type de laveur
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Welcome Screen
  if (mode === 'welcome') {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#FF9800] to-[#F57C00]">
        {/* Logo Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <img 
            src="/android-chrome-192x192.png" 
            alt="Socline" 
            className="w-24 h-24 mb-6 object-contain"
          />
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
          <button
            onClick={() => setMode('register')}
            className="w-full h-14 border-2 border-white text-white bg-transparent hover:bg-white/10 rounded-2xl font-semibold text-lg transition-colors"
          >
            Créer un compte
          </button>
          
          {/* Discrete Washer Link */}
          <button
            onClick={() => setMode('washer-type')}
            className="w-full text-center text-white/60 text-sm hover:text-white/80 transition-colors mt-4 py-2"
          >
            <span className="flex items-center justify-center gap-1">
              Devenir partenaire laveur
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>
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
              S&apos;inscrire
            </button>
          </p>
          
          {/* Discrete Washer Link */}
          <button
            onClick={() => setMode('washer-type')}
            className="w-full text-center text-[#9E9E9E] text-sm hover:text-[#757575] transition-colors mt-4"
          >
            Devenir partenaire laveur ?
          </button>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (mode === 'verify-otp') {
    return (
      <div className="flex-1 flex flex-col bg-[#FFF8F0]">
        {/* Header */}
        <div className="bg-[#FF9800] p-4 pt-8 pb-12 rounded-b-3xl">
          <button onClick={() => setMode(getRegisterMode())} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Vérification</h1>
          <p className="text-white/80 mt-1">Entrez le code envoyé au +228 {phone}</p>
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
            
            {/* OTP Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#757575]">Code de vérification (6 chiffres)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
                <Input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="pl-10 h-14 bg-[#F5F5F5] border-0 rounded-xl text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-[#9E9E9E] text-center">
                Code de test: <span className="font-mono font-bold">123456</span>
              </p>
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.length !== 6}
              className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Vérifier et créer mon compte
                </>
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center pt-2">
              {resendTimer > 0 ? (
                <p className="text-sm text-[#9E9E9E]">
                  Renvoyer le code dans {resendTimer}s
                </p>
              ) : (
                <button
                  onClick={handleSendOtp}
                  className="text-sm text-[#FF9800] font-semibold"
                >
                  Renvoyer le code
                </button>
              )}
            </div>
          </div>

          <p className="text-center mt-4 text-[#757575]">
            <button onClick={() => setMode(getRegisterMode())} className="text-[#FF9800] font-semibold">
              Modifier le numéro
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

          {/* Confirm PIN */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#757575]">Confirmer le code PIN</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9E9E9E]" />
              <Input
                type={showConfirmPin ? 'text' : 'password'}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="pl-10 pr-10 h-12 bg-[#F5F5F5] border-0 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
              >
                {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPin.length > 0 && pin === confirmPin && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Les codes correspondent
              </p>
            )}
          </div>

          <Button
            onClick={handleSendOtp}
            disabled={isLoading}
            className="w-full h-12 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl font-semibold"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Continuer
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
        
        {/* Discrete Washer Link */}
        <button
          onClick={() => setMode('washer-type')}
          className="w-full text-center text-[#9E9E9E] text-sm hover:text-[#757575] transition-colors mt-4"
        >
          Devenir partenaire laveur ?
        </button>
      </div>
    </div>
  );
}
