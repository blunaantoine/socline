/**
 * Identité web canonique de Socline (SEO / metadata / sitemap / robots).
 * Centralisé ici pour qu'une seule source soit partagée par tout le site.
 *
 * Pour basculer sur un autre domaine (ex. socline.tg quand il sera branché),
 * définir NEXT_PUBLIC_SITE_URL dans .env — aucune ligne de code à modifier.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
  'https://socline.oquitogo.com';

export const SITE_NAME = 'Socline';
export const SITE_DESCRIPTION =
  'Réservez un lavage professionnel en quelques clics. Nos laveurs certifiés viennent à vous, où que vous soyez, à Lomé et partout au Togo.';

/** Image de partage (Open Graph / Twitter) : laveur Socline au travail. */
export const SITE_OG_IMAGE = '/carousel/lavage-1.png';
