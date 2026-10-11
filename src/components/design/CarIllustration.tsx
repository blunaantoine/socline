'use client';

/**
 * CarIllustration — voiture vue de côté, style vectoriel plat.
 * Illustration réutilisable des cartes de formule et du bandeau promo
 * (voir maquette-accueil.html). La couleur se pilote via `text-*` ou
 * `style.color` (currentColor) ; les roues restent navy pour rester
 * lisibles sur toutes les teintes.
 */
export function CarIllustration({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 120 56" className={className} style={style} aria-hidden="true">
      {/* Carrosserie */}
      <path
        d="M6 40V31c0-4 3-6 7-7l17-3 10-11c2-2 4-3 7-3h31c4 0 7 1 9 4l9 10 10 3c5 1 8 4 8 8v8z"
        fill="currentColor"
      />
      {/* Vitres */}
      <path d="M44 14h30c2 0 3 1 4 2l7 9H37z" fill="#fff" opacity=".85" />
      {/* Roues */}
      <circle cx="33" cy="42" r="9" fill="#0F1B2D" />
      <circle cx="33" cy="42" r="3.5" fill="#CBD1DA" />
      <circle cx="88" cy="42" r="9" fill="#0F1B2D" />
      <circle cx="88" cy="42" r="3.5" fill="#CBD1DA" />
    </svg>
  );
}
