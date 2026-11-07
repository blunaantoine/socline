/**
 * Secrets serveur — source unique.
 *
 * En production, l'application ne doit JAMAIS signer de sessions avec une
 * valeur connue publiquement (elle est dans le dépôt) : si JWT_SECRET est
 * absent, on lève une erreur explicite au premier usage plutôt que de
 * retomber sur une clé de secours. Le contrôle est paresseux (au moment de
 * signer/vérifier) pour ne pas casser `next build`, qui charge les modules.
 * En développement, une clé locale fixe garde l'app testable sans .env.
 */
const DEV_FALLBACK_SECRET = 'socline-dev-only-secret';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET manquant : définissez-le dans le .env du serveur (ex. openssl rand -hex 32). ' +
        'Refus de signer des sessions avec une clé par défaut en production.'
    );
  }
  return DEV_FALLBACK_SECRET;
}
