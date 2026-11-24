import { toast } from 'sonner';

/**
 * Partage le lien public « Devenir partenaire laveur » (/partenaire) :
 * feuille de partage native du téléphone (WhatsApp, SMS…) si disponible,
 * sinon copie du lien dans le presse-papiers.
 */
export async function sharePartnerLink(): Promise<void> {
  const url = `${window.location.origin}/partenaire`;
  const title = 'Devenir partenaire laveur — Socline';
  const text =
    'Laveur ou station de lavage à Lomé ? Rejoignez Socline et gardez de 70 % à 80 % de chaque lavage.';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      // L'utilisateur a fermé la feuille de partage : rien à faire.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success('Lien copié', { description: url });
  } catch {
    toast.info('Partagez ce lien', { description: url });
  }
}
