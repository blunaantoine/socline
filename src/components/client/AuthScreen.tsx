'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Car, Phone, User, Lock, Palette, ArrowLeft,
  Eye, EyeOff, CheckCircle, Loader2, AlertCircle, Check, MessageCircle,
  FileText, Download, IdCard, CreditCard, ChevronRight,
  MapPin, Building, Info, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '@/store';

type WasherType = 'INDEPENDENT' | 'STATION_OWNER';

// Extract the API's real error message (e.g. « Numéro non enregistré »,
// « PIN incorrect ») from a failed response — fall back to a generic message
// only for unexpected failures (network/5xx without a JSON payload).
async function serverErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error && typeof data.error === 'string') return data.error;
  } catch {
    // Not JSON — keep the fallback.
  }
  return fallback;
}

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

/* ────────────────────────────────────────────────────────────────────────────
   Design tokens auth (maquette « Inscription en étapes »).
   - Fond crème #FFF7ED, texte #1C1410, bordures #E7D9CB
   - Accent #C2410C : blanc sur #FF9800 ≈ 2:1 (illisible) → blanc sur
     #C2410C ≈ 4.9:1 (AA). L'orange vif #FF9800 reste réservé à la marque.
   - Tous les écrans respectent les zones sûres (barre d'état en haut,
     barre de navigation Android en bas) via max(env(), var(--safe-area-inset-*)).
   ──────────────────────────────────────────────────────────────────────────── */
const AUTH_BG = 'bg-[#FFF7ED]';
const AUTH_BORDER = 'border-[#E7D9CB]';
const ACCENT_BTN = 'bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-2xl font-bold text-base';
// Bord orange fin + halo léger au focus (recouvre les styles shadcn par défaut).
const FOCUS_RING = 'focus-visible:border-[#C2410C] focus-visible:ring-[#C2410C]/20';
// Paddings de zones sûres (headers et footers).
const SAFE_TOP = 'pt-[calc(1rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))]';
const SAFE_BOTTOM = 'pb-[calc(1.25rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]';

/* Bouton retour rond (maquette) — 44 px minimum, cible tactile. */
function AuthBackButton({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-full bg-white border-[1.5px] border-[#E7D9CB] flex items-center justify-center text-[#1C1410] active:scale-95 transition-transform flex-shrink-0"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}

/* Barre de progression 3 segments + « Étape X sur 3 » (maquette). */
function AuthProgress({ step }: { step: number }) {
  const labels = ['Identité', 'Véhicule', 'Sécurité'];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1C1410]">Étape {step} sur 3</p>
        <p className="text-sm text-[#6B5B4E]">{labels[step - 1]}</p>
      </div>
      <div
        className="flex gap-2"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={3}
        aria-label={`Étape ${step} sur 3`}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#C2410C]' : 'bg-[#E7D9CB]'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* Erreur sous un champ (maquette : messages d'erreur sous les champs). */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  );
}

/* Bandeau d'erreur global (serveur / connexion). */
function AuthError({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl"
      role="alert"
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

/* Champ téléphone : drapeau 🇹🇬 + préfixe +228 dans un bloc séparé (maquette). */
function PhoneField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="auth-phone" className="text-sm font-medium text-[#1C1410]">
        Numéro de téléphone
      </label>
      <div className="flex gap-2">
        <div
          className={`h-12 px-3 bg-white border-[1.5px] ${
            error ? 'border-red-400' : 'border-[#E7D9CB]'
          } rounded-xl flex items-center gap-1.5 flex-shrink-0`}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            🇹🇬
          </span>
          <span className="text-sm font-semibold text-[#1C1410]">+228</span>
        </div>
        <Input
          id="auth-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="90 12 34 56"
          aria-label="Numéro à 8 chiffres, sans l'indicatif"
          aria-invalid={!!error}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className={`flex-1 min-w-0 h-12 bg-white border-[1.5px] ${
            error ? 'border-red-400' : 'border-[#E7D9CB]'
          } rounded-xl text-[#1C1410] placeholder:text-[#B8A99A] ${FOCUS_RING}`}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

/* Sélecteur de couleur : 10 pastilles rondes sans texte (maquette).
   État sélectionné net : anneau accent + coche ; le nom de la couleur
   s'affiche à droite du titre. */
function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const selected = CAR_COLORS.find((c) => c.id === value);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between min-h-5">
        <label className="text-sm font-medium text-[#1C1410] flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#C2410C]" />
          Couleur de la voiture
        </label>
        {selected && (
          <span className="text-sm font-semibold text-[#C2410C]" aria-live="polite">
            {selected.label}
          </span>
        )}
      </div>
      <div
        className="grid grid-cols-5 gap-x-3 gap-y-2"
        role="radiogroup"
        aria-label="Couleur de la voiture"
      >
        {CAR_COLORS.map((color) => {
          const isSelected = value === color.id;
          // Coche sombre sur les pastilles claires pour rester visible.
          const isLight = ['Blanc', 'Beige', 'Jaune', 'Argent'].includes(color.id);
          return (
            <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={color.label}
              onClick={() => onChange(color.id)}
              className={`flex items-center justify-center rounded-full aspect-square transition-all ${
                isSelected
                  ? 'ring-2 ring-[#C2410C] ring-offset-2 ring-offset-[#FFF7ED]'
                  : 'ring-1 ring-[#E7D9CB] ring-offset-0 active:scale-95'
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: color.color,
                  border: isLight ? '1px solid rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {isSelected && (
                  <Check
                    className={`w-4 h-4 ${isLight ? 'text-[#1C1410]' : 'text-white'}`}
                    strokeWidth={3}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

/* Code PIN : 4 cases séparées, chiffres masqués, clavier numérique (maquette). */
function PinBoxes({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <InputOTP
        maxLength={4}
        value={value}
        onChange={(v) => onChange(v.replace(/\D/g, '').slice(0, 4))}
        aria-label="Code PIN à 4 chiffres"
        containerClassName="w-full justify-between gap-2"
      >
        <InputOTPGroup className="flex gap-2 w-full">
          {[0, 1, 2, 3].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              masked
              className="h-14 flex-1 min-w-0 rounded-xl border-[1.5px] border-[#E7D9CB] bg-white text-xl font-bold text-[#1C1410] shadow-none first:rounded-xl last:rounded-xl data-[active=true]:border-[#C2410C] data-[active=true]:ring-[#C2410C]/30"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <FieldError message={error} />
    </div>
  );
}

/* Code de vérification : 6 cases (maquette) — validation dès le 6e chiffre
   gérée par l'auto-submit dans AuthScreen. */
function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      disabled={disabled}
      aria-label="Code de vérification à 6 chiffres"
      containerClassName="w-full justify-center gap-2"
    >
      <InputOTPGroup className="flex gap-2 w-full">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-14 flex-1 min-w-0 rounded-[14px] border-[1.5px] border-[#E7D9CB] bg-white text-2xl font-bold text-[#1C1410] shadow-none first:rounded-[14px] last:rounded-[14px] data-[active=true]:border-[#C2410C] data-[active=true]:ring-[#C2410C]/30"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

// Washer Registration Info Component
function WasherRegistrationInfo({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
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
      <div className="bg-[#4CAF50] p-4 pt-[calc(1.5rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] pb-12 rounded-b-3xl">
        <button onClick={onBack} className="text-white mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Devenir Laveur</h1>
        <p className="text-white/90 mt-1">Rejoignez notre équipe de partenaires</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-[calc(2rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
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
                  <CreditCard className="w-5 h-5 text-[#C2410C]" />
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
              <TrendingUp className="w-5 h-5 text-[#C2410C]" />
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
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C2410C] to-[#9A3412] text-white flex flex-col items-center justify-center flex-shrink-0">
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
                className="flex-1 bg-[#167D4A] text-white rounded-lg py-2 text-center font-medium text-sm"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* CTA — passage à l'étape suivante : choix du type de laveur.
              whitespace-normal + h-auto : le libellé long ne doit JAMAIS être
              rogné par le nowrap du Button sur petits écrans (débordement
              signalé sur « Devenir partenaire »). */}
          <Button
            onClick={onContinue}
            className="w-full min-h-14 h-auto py-3 whitespace-normal leading-snug bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-2xl font-semibold text-base shadow-lg"
          >
            Continuer — Choisir mon type
            <ChevronRight className="w-5 h-5 ml-1 flex-shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AuthScreen({ onComplete }: AuthScreenProps) {
  type AuthMode = 'welcome' | 'login' | 'register' | 'verify-otp' | 'washer-info' | 'washer-type' | 'register-independent' | 'register-station';
  const [mode, setMode] = useState<AuthMode>('welcome');
  // Option B : la page « conditions du partenariat » s'affiche AVANT le choix du type.
  // On mémorise l'écran d'origine pour que la flèche retour ramène au bon endroit.
  const [infoOrigin, setInfoOrigin] = useState<AuthMode>('welcome');
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

  // Inscription client en 3 étapes : 1 Identité · 2 Véhicule · 3 Sécurité
  const [regStep, setRegStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

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
  // Demo mode (no SMS provider configured): the send-otp response contains
  // demoCode — shown in a dismissible banner and auto-filled. With a real
  // provider the code never appears in the API response.
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const { login } = useAuthStore();

  // Timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  /* ── Validation par étape du wizard client ── */
  const clearFieldError = (key: string) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validateRegStep = (step: number): boolean => {
    const errs: Record<string, string | undefined> = {};
    if (step === 1) {
      if (!name.trim()) errs.name = 'Veuillez entrer votre nom';
      if (!phone.trim() || phone.length < 8) errs.phone = 'Entrez les 8 chiffres de votre numéro';
    } else if (step === 2) {
      if (!plateNumber.trim()) errs.plateNumber = 'Veuillez entrer le numéro de plaque';
      if (!carColor) errs.carColor = 'Sélectionnez la couleur de votre voiture';
    } else {
      if (pin.length !== 4) errs.pin = 'Le PIN doit contenir 4 chiffres';
      if (confirmPin.length !== 4) errs.confirmPin = 'Confirmez votre PIN';
      else if (pin !== confirmPin) errs.confirmPin = 'Les codes PIN ne correspondent pas';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // CTA du wizard : Continuer (étapes 1-2) puis envoi du SMS (étape 3).
  const handleRegContinue = () => {
    if (!validateRegStep(regStep)) return;
    if (regStep < 3) {
      setError(null);
      setRegStep(regStep + 1);
    } else {
      handleSendOtp();
    }
  };

  // Send OTP for registration
  const handleSendOtp = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setError('Numéro de téléphone invalide (8 chiffres requis)');
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
        setError(await serverErrorMessage(res, 'Erreur du serveur. Réessayez.'));
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setError('Réponse invalide du serveur');
        return;
      }
      const data = await res.json();

      if (data.success) {
        if (data.demoMode && data.demoCode) {
          setDemoCode(data.demoCode);
          setOtp(data.demoCode); // auto-fill in demo mode for a smooth flow
        } else {
          setDemoCode(null);
          setOtp('');
        }
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
        setError(await serverErrorMessage(res, 'Erreur du serveur. Réessayez.'));
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
      setError('Numéro de téléphone invalide (8 chiffres requis)');
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
        setError(await serverErrorMessage(res, 'Erreur du serveur. Réessayez.'));
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
  // registration or navigates back to welcome/login. The wizard client
  // repart de l'étape 1 uniquement quand on revient à l'accueil / connexion.
  useEffect(() => {
    if (mode === 'welcome' || mode === 'register' || mode === 'login') {
      setWasherType(null);
    }
    if (mode === 'welcome' || mode === 'login') {
      setRegStep(1);
      setFieldErrors({});
    }
    // On repart d'un état propre : l'erreur d'un écran ne doit jamais
    // fuiter vers l'écran suivant (ex : « numéro déjà enregistré » de
    // l'inscription qui apparaîtrait sur la connexion).
    setError(null);
    // Les champs sensibles sont vidés au retour à l'accueil — jamais entre
    // inscription et vérification (l'utilisateur y revient via « Modifier
    // le numéro »).
    if (mode === 'welcome') {
      setPin('');
      setConfirmPin('');
      setOtp('');
    }
  }, [mode]);

  // Validation automatique dès que le 6e chiffre est saisi (ou collé,
  // ou auto-rempli en mode démo). Le garde-fou autoSubmitRef garantit un
  // seul envoi automatique par saisie complète — l'utilisateur peut toujours
  // appuyer sur le bouton après une correction.
  const autoSubmitRef = useRef(false);
  const verifyOtpRef = useRef(handleVerifyOtp);
  verifyOtpRef.current = handleVerifyOtp;
  useEffect(() => {
    if (otp.length < 6) {
      autoSubmitRef.current = false;
      return;
    }
    if (mode === 'verify-otp' && !autoSubmitRef.current && !isLoading) {
      autoSubmitRef.current = true;
      verifyOtpRef.current();
    }
  }, [otp, mode, isLoading]);

  // Washer Info Screen
  if (mode === 'washer-info') {
    return (
      <WasherRegistrationInfo
        onBack={() => setMode(infoOrigin)}
        onContinue={() => setMode('washer-type')}
      />
    );
  }

  // Washer Type Selection Screen
  if (mode === 'washer-type') {
    return (
      <div className="flex-1 flex flex-col bg-[#FFF8F0]">
        {/* Header */}
        <div className="bg-[#E65100] p-4 pt-[calc(2rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] pb-12 rounded-b-3xl">
          <button onClick={() => setMode('welcome')} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Devenir Laveur</h1>
          <p className="text-white/90 mt-1">Choisissez votre type d&apos;activité</p>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-[calc(2rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
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
              onClick={() => {
                setInfoOrigin('washer-type');
                setMode('washer-info');
              }}
              className="w-full text-center text-[#C2410C] text-sm hover:text-[#F57C00] transition-colors mt-2 py-2 flex items-center justify-center gap-1"
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
        <div className="bg-[#E65100] p-4 pt-[calc(2rem+max(env(safe-area-inset-top),var(--safe-area-inset-top,0px)))] pb-12 rounded-b-3xl">
          <button onClick={() => setMode('washer-type')} className="text-white mb-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isStation ? 'Inscription Station' : 'Inscription Laveur'}
          </h1>
          <p className="text-white/90 mt-1">
            {isStation
              ? 'Créez votre compte de station de lavage'
              : 'Créez votre compte de laveur indépendant'}
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 p-4 -mt-6 overflow-y-auto pb-[calc(2rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
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
                <Building className="w-5 h-5 text-[#C2410C]" />
              ) : (
                <Car className="w-5 h-5 text-[#C2410C]" />
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
                  placeholder="Ex : Kofi Mensah"
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
                    <Building className="w-4 h-4 text-[#C2410C]" />
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
                  inputMode="numeric"
                  autoComplete="new-password"
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
                  inputMode="numeric"
                  autoComplete="new-password"
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
              className="w-full h-12 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl font-semibold"
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
            <button onClick={() => setMode('washer-type')} className="text-[#C2410C] font-semibold">
              Changer de type de laveur
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Welcome Screen — dégradé plus profond : le blanc y devient lisible
  // (le contraste blanc sur #FF9800 était ≈ 2:1).
  if (mode === 'welcome') {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#F57C00] to-[#C2410C]">
        {/* Logo Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 pt-safe">
          <div className="w-28 h-28 rounded-full bg-white shadow-lg flex items-center justify-center mb-6 overflow-hidden">
            <img
              src="/android-chrome-192x192.png"
              alt="Socline"
              className="w-20 h-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Socline</h1>
          <p className="text-white/95 text-center">Votre lavage auto à domicile</p>
        </div>

        {/* Buttons */}
        <div className="p-6 space-y-3 pb-[calc(1.5rem+max(env(safe-area-inset-bottom),var(--safe-area-inset-bottom,0px)))]">
          <Button
            onClick={() => setMode('login')}
            className="w-full h-14 bg-white text-[#C2410C] hover:bg-white/90 rounded-2xl font-bold text-lg"
          >
            Se connecter
          </Button>
          <button
            onClick={() => setMode('register')}
            className="w-full h-14 border-2 border-white/90 text-white bg-transparent hover:bg-white/10 rounded-2xl font-bold text-lg transition-colors"
          >
            Créer un compte
          </button>

          {/* Discrete Washer Link — option B : page info partenariat en premier */}
          <button
            onClick={() => {
              setInfoOrigin('welcome');
              setMode('washer-info');
            }}
            className="w-full text-center text-white/70 text-sm hover:text-white/90 transition-colors mt-4 py-2"
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

  // Login Screen — style maquette : fond crème, bouton retour rond, CTA accent.
  if (mode === 'login') {
    return (
      <div className={`flex-1 flex flex-col ${AUTH_BG}`}>
        {/* Header */}
        <div className={`px-6 ${SAFE_TOP}`}>
          <AuthBackButton onClick={() => setMode('welcome')} />
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-safe">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-[#1C1410]">
            Connexion
          </h1>
          <p className="mt-1.5 text-base text-[#6B5B4E]">Ravi de vous revoir sur Socline</p>

          {error && <div className="mt-5"><AuthError message={error} /></div>}

          <div className="mt-7 space-y-5">
            <PhoneField value={phone} onChange={setPhone} />

            <div className="space-y-2">
              <label htmlFor="login-pin" className="text-sm font-medium text-[#1C1410]">
                Code PIN
              </label>
              <PinBoxes value={pin} onChange={setPin} />
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className={`w-full h-14 mt-8 ${ACCENT_BTN}`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Se connecter'
            )}
          </Button>

          <p className="text-center mt-5 text-sm text-[#6B5B4E]">
            Pas encore de compte ?{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="font-bold text-[#C2410C]"
            >
              S&apos;inscrire
            </button>
          </p>

          {/* Discrete Washer Link — option B : page info partenariat en premier */}
          <button
            onClick={() => {
              setInfoOrigin('login');
              setMode('washer-info');
            }}
            className="w-full text-center text-[#9E9E9E] text-sm hover:text-[#6B5B4E] transition-colors mt-5 pb-2"
          >
            Devenir partenaire laveur ?
          </button>
        </div>
      </div>
    );
  }

  // OTP Verification Screen — maquette : illustration centrée, 6 cases,
  // validation dès le 6e chiffre, renvoi en lien après le compte à rebours.
  if (mode === 'verify-otp') {
    const formattedPhone = phone.replace(/(\d{2})(?=\d)/g, '$1 ');
    return (
      <div className={`flex-1 flex flex-col ${AUTH_BG}`}>
        {/* Header — bouton retour rond */}
        <div className={`px-6 ${SAFE_TOP}`}>
          <AuthBackButton onClick={() => setMode(getRegisterMode())} />
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-safe">
          {/* Illustration + textes centrés */}
          <div className="flex flex-col items-center text-center">
            <div className="w-[88px] h-[88px] rounded-full bg-[#FFE8D1] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-10 h-10 text-[#C2410C]" strokeWidth={1.7} />
            </div>
            <h1 className="mt-7 text-[28px] leading-tight font-extrabold tracking-tight text-[#1C1410]">
              Vérifiez votre numéro
            </h1>
            <p className="mt-3 max-w-[300px] text-base leading-relaxed text-[#6B5B4E]">
              Entrez le code à 6 chiffres envoyé au{' '}
              <strong className="text-[#1C1410] font-bold">+228 {formattedPhone}</strong>
            </p>
            <button
              type="button"
              onClick={() => setMode(getRegisterMode())}
              className="mt-2.5 text-[15px] font-bold text-[#C2410C] underline-offset-4 hover:underline"
            >
              Modifier le numéro
            </button>
          </div>

          {/* Bandeau erreur */}
          {error && <div className="mt-5"><AuthError message={error} /></div>}

          {/* Demo mode banner (SMS provider not configured) */}
          {demoCode && (
            <div className="mt-5 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm flex-1">
                Mode démo : SMS non configuré — votre code est{' '}
                <span className="font-mono font-bold">{demoCode}</span>
              </span>
              <button
                type="button"
                onClick={() => setDemoCode(null)}
                className="text-amber-700 font-bold leading-none"
                aria-label="Masquer le code de démo"
              >
                ×
              </button>
            </div>
          )}

          {/* 6 cases OTP */}
          <div className="mt-9">
            <OtpBoxes value={otp} onChange={setOtp} disabled={isLoading} />
          </div>

          {/* Renvoi du code — lien actif après le compte à rebours */}
          <div className="mt-5 text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-[#6B5B4E]">
                Nouveau code disponible dans{' '}
                <span className="font-semibold text-[#1C1410]">{resendTimer} s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                className="text-sm font-bold text-[#C2410C] underline underline-offset-4"
              >
                Renvoyer le code
              </button>
            )}
          </div>
        </div>

        {/* CTA fixé en bas — toujours visible, au-dessus de la barre système */}
        <div className={`px-6 pt-3 bg-[#FFF7ED] ${SAFE_BOTTOM}`}>
          <Button
            onClick={handleVerifyOtp}
            disabled={isLoading || otp.length !== 6}
            className={`w-full h-14 ${ACCENT_BTN}`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Vérifier et créer mon compte'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Register Screen — wizard 3 étapes (maquette) :
  // 1 Identité (nom, téléphone) · 2 Véhicule (plaque, couleur) · 3 Sécurité (PIN).
  if (mode === 'register') {
    const stepTitles = ['Qui êtes-vous ?', 'Votre véhicule', 'Sécurité'];
    const stepSubtitles = [
      'Votre nom et votre numéro de téléphone',
      'La plaque et la couleur de votre voiture',
      'Choisissez un code PIN à 4 chiffres',
    ];
    return (
      <div className={`flex-1 flex flex-col ${AUTH_BG}`}>
        {/* Header : retour + barre de progression */}
        <div className={`px-6 space-y-5 ${SAFE_TOP}`}>
          <AuthBackButton
            onClick={() => (regStep === 1 ? setMode('welcome') : setRegStep(regStep - 1))}
          />
          <AuthProgress step={regStep} />
        </div>

        {/* Contenu de l'étape */}
        <div className="flex-1 overflow-y-auto px-6 pt-6">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-[#1C1410]">
            {stepTitles[regStep - 1]}
          </h1>
          <p className="mt-1.5 text-[15px] text-[#6B5B4E]">{stepSubtitles[regStep - 1]}</p>

          {error && <div className="mt-5"><AuthError message={error} /></div>}

          <div className="mt-6 space-y-5 pb-6">
            {/* Étape 1 — Identité */}
            {regStep === 1 && (
              <>
                <div className="space-y-2">
                  <label htmlFor="reg-name" className="text-sm font-medium text-[#1C1410]">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8A99A]" />
                    <Input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Ex : Kofi Mensah"
                      aria-invalid={!!fieldErrors.name}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError('name');
                      }}
                      className={`pl-11 h-12 bg-white border-[1.5px] ${
                        fieldErrors.name ? 'border-red-400' : 'border-[#E7D9CB]'
                      } rounded-xl text-[#1C1410] placeholder:text-[#B8A99A] ${FOCUS_RING}`}
                    />
                  </div>
                  <FieldError message={fieldErrors.name} />
                </div>

                <PhoneField
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    clearFieldError('phone');
                  }}
                  error={fieldErrors.phone}
                />
              </>
            )}

            {/* Étape 2 — Véhicule */}
            {regStep === 2 && (
              <>
                <div className="space-y-2">
                  <label htmlFor="reg-plate" className="text-sm font-medium text-[#1C1410]">
                    Numéro de plaque
                  </label>
                  <div className="relative">
                    <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8A99A]" />
                    <Input
                      id="reg-plate"
                      type="text"
                      placeholder="Ex : TG 1234 A"
                      aria-invalid={!!fieldErrors.plateNumber}
                      value={plateNumber}
                      onChange={(e) => {
                        setPlateNumber(e.target.value.toUpperCase());
                        clearFieldError('plateNumber');
                      }}
                      className={`pl-11 h-12 bg-white border-[1.5px] ${
                        fieldErrors.plateNumber ? 'border-red-400' : 'border-[#E7D9CB]'
                      } rounded-xl uppercase text-[#1C1410] placeholder:text-[#B8A99A] ${FOCUS_RING}`}
                    />
                  </div>
                  <p className="text-xs text-[#6B5B4E]">
                    Majuscules automatiques — format togolais (ex : TG 1234 A)
                  </p>
                  <FieldError message={fieldErrors.plateNumber} />
                </div>

                <ColorPicker
                  value={carColor}
                  onChange={(v) => {
                    setCarColor(v);
                    clearFieldError('carColor');
                  }}
                  error={fieldErrors.carColor}
                />
              </>
            )}

            {/* Étape 3 — Sécurité */}
            {regStep === 3 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1C1410]">
                    Créez votre code PIN
                  </label>
                  <PinBoxes
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      clearFieldError('pin');
                    }}
                    error={fieldErrors.pin}
                  />
                  <p className="text-xs text-[#6B5B4E]">
                    Ce code servira à vous connecter — ne le partagez pas.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#1C1410]">
                    Confirmez le code PIN
                  </label>
                  <PinBoxes
                    value={confirmPin}
                    onChange={(v) => {
                      setConfirmPin(v);
                      clearFieldError('confirmPin');
                    }}
                    error={fieldErrors.confirmPin}
                  />
                  {/* Indicateur live de correspondance des codes */}
                  {pin.length === 4 && confirmPin.length === 4 && (
                    pin === confirmPin ? (
                      <p
                        className="text-sm text-green-600 font-semibold flex items-center gap-1.5"
                        aria-live="polite"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Les codes correspondent
                      </p>
                    ) : (
                      <p
                        className="text-sm text-red-500 font-medium flex items-center gap-1.5"
                        aria-live="polite"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Les codes ne correspondent pas
                      </p>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer : CTA + liens — jamais chevauché par la barre système */}
        <div
          className={`px-6 pt-3 bg-[#FFF7ED] space-y-3 ${SAFE_BOTTOM}`}
        >
          <Button
            onClick={handleRegContinue}
            disabled={isLoading}
            className={`w-full h-14 ${ACCENT_BTN}`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : regStep < 3 ? (
              <>
                Continuer
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            ) : (
              'Créer mon compte'
            )}
          </Button>

          <p className="text-center text-sm text-[#6B5B4E]">
            Déjà un compte ?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="font-bold text-[#C2410C]"
            >
              Se connecter
            </button>
          </p>

          {/* Discrete Washer Link — option B : page info partenariat en premier */}
          <button
            onClick={() => {
              setInfoOrigin('register');
              setMode('washer-info');
            }}
            className="w-full text-center text-[#9E9E9E] text-sm hover:text-[#6B5B4E] transition-colors pb-1"
          >
            Devenir partenaire laveur ?
          </button>
        </div>
      </div>
    );
  }
}
