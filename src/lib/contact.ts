// Helpers de contact externe — utilisables côté client (aucun import serveur).

// Numéro de téléphone du support Socline (Lomé, Togo) — partagé par les
// écrans Profil / Aide et par les redirections WhatsApp.
export const SOCLINE_SUPPORT_PHONE = '+22871998155';

// Convertit un numéro stocké en base vers le format international SANS « + »
// requis par wa.me. Formats tolérés (Togo) :
//   "90234567"      → 22890234567
//   "09023456"      → 22890234567
//   "0022890234567" → 22890234567
//   "+22890234567"  → 22890234567
// Retourne null si le numéro est vide ou incompréhensible.
function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00228')) return digits.slice(2); // garde "228…"
  if (digits.startsWith('228')) return digits; // déjà indicatif Togo
  if (/^0\d{8}$/.test(digits)) return `228${digits.slice(1)}`;
  if (/^\d{8}$/.test(digits)) return `228${digits}`;
  return null;
}

// Construit un lien https://wa.me/<numéro>?text=<message> pour ouvrir une
// discussion WhatsApp pré-remplie. Retourne null si le numéro est absent
// ou invalide (le bouton appelant doit alors rester désactivé).
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  if (!phone) return null;
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Ouvre WhatsApp dans un nouvel onglet. No-op silencieux si le numéro est
// absent/invalide — les boutons doivent être désactivés dans ce cas.
export function openWhatsApp(phone: string | null | undefined, message: string): void {
  const url = buildWhatsAppUrl(phone, message);
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
