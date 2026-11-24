import type { Metadata } from 'next';
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from '@/lib/site';
import { PartnerEntry } from './PartnerEntry';

/**
 * Lien public et partageable « Devenir partenaire laveur » :
 * https://socline.oquitogo.com/partenaire ouvre directement l'écran de
 * présentation du partenariat (avantages, barème, documents), puis
 * l'inscription laveur indépendant ou station.
 */
const TITLE = 'Devenir partenaire laveur — Socline';
const DESCRIPTION =
  'Laveur indépendant ou station de lavage à Lomé ? Rejoignez Socline : recevez des clients près de chez vous et gardez de 70 % à 80 % de chaque lavage.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/partenaire' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/partenaire`,
    siteName: SITE_NAME,
    locale: 'fr_TG',
    type: 'website',
    images: [{ url: SITE_OG_IMAGE, width: 1344, height: 768, alt: 'Laveur Socline en train de laver une voiture à Lomé' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [SITE_OG_IMAGE] },
};

export default function PartenairePage() {
  return <PartnerEntry />;
}
