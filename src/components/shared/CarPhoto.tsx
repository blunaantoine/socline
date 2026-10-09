'use client';

// CarPhoto — vignette du véhicule : photo réelle du client si elle existe,
// sinon une image de voiture par défaut aux couleurs de la marque
// (remplace les anciens grands icônes « Car » plats).
//
// Tous les emplacements (sélection de véhicule, suivi de commande, liste
// « Mes véhicules », reconnaissance côté laveur) utilisent des vignettes
// carrées object-cover — la même image fonctionne partout.
export const DEFAULT_CAR_IMAGE = '/voiture-defaut.png';

export function CarPhoto({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src || DEFAULT_CAR_IMAGE}
      alt={alt}
      className={`object-cover flex-shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
