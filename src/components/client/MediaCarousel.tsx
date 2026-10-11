'use client';

// ---------------------------------------------------------------------------
// Socline — Carrousel média (images + vidéos) de la page d'accueil et de la
// page Réserver.
//
// Fonctionnement :
//   - défilement tactile natif (scroll-snap) + flèches sur desktop ;
//   - auto-défilement toutes les 5 s — mis en pause 8 s après une interaction
//     et pendant la lecture d'une vidéo ;
//   - points de navigation + légende sur dégradé, bouton « Réserver » optionnel.
//
// Pour AJOUTER UNE VIDÉO : déposez le fichier dans /public/carousel/ puis
// ajoutez simplement dans MEDIA_ITEMS :
//   { type: 'video', src: '/carousel/ma-video.mp4', caption: '…' }
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type MediaItem = {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  caption?: string;
};

const MEDIA_ITEMS: MediaItem[] = [
  {
    type: 'image',
    src: '/carousel/lavage-1.png',
    alt: 'Lavage à la mousse professionnelle',
    caption: 'Lavage mousse professionnel',
  },
  {
    type: 'image',
    src: '/carousel/lavage-2.png',
    alt: 'Nettoyage haute pression',
    caption: 'Nettoyage haute pression',
  },
  {
    type: 'image',
    src: '/carousel/lavage-3.png',
    alt: 'Détail intérieur du véhicule',
    caption: 'Détail intérieur soigné',
  },
  {
    type: 'image',
    src: '/carousel/lavage-4.png',
    alt: 'Laveur professionnel souriant',
    caption: 'Des laveurs pros à votre service',
  },
  {
    type: 'image',
    src: '/carousel/lavage-5.png',
    alt: 'Voiture brillante après le lavage',
    caption: 'Un résultat éclatant garanti',
  },
];

const AUTOPLAY_DELAY = 5000; // défilement automatique (ms)
const INTERACTION_PAUSE = 8000; // pause après une interaction (ms)

export function MediaCarousel({
  onReserve,
  className = '',
}: {
  /** Affiche un bouton « Réserver » sur chaque diapositive (page d'accueil) */
  onReserve?: () => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const videoPlayingRef = useRef(false);
  const [index, setIndex] = useState(0);
  const count = MEDIA_ITEMS.length;

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const clamped = ((i % count) + count) % count;
      indexRef.current = clamped;
      setIndex(clamped);
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    },
    [count]
  );

  // Synchronise l'index quand l'utilisateur fait défiler à la main (swipe)
  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
    }
  }, [count]);

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  // Auto-défilement : images uniquement, en pause après interaction / vidéo
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastInteractionRef.current < INTERACTION_PAUSE) return;
      if (videoPlayingRef.current) return;
      if (MEDIA_ITEMS[indexRef.current]?.type === 'video') return;
      goTo(indexRef.current + 1);
    }, AUTOPLAY_DELAY);
    return () => clearInterval(timer);
  }, [goTo]);

  if (count === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={markInteraction}
        onTouchStart={markInteraction}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl shadow-sm select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MEDIA_ITEMS.map((item, i) => (
          <div
            key={item.src}
            className="relative w-full flex-shrink-0 snap-center aspect-[16/9] max-h-[420px] bg-[#EEEEEE]"
          >
            {item.type === 'image' ? (
              <img
                src={item.src}
                alt={item.alt || ''}
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={item.src}
                muted
                loop
                playsInline
                autoPlay={i === index}
                preload={i === index ? 'auto' : 'metadata'}
                onPlay={() => {
                  videoPlayingRef.current = true;
                }}
                onPause={() => {
                  videoPlayingRef.current = false;
                }}
                className="w-full h-full object-cover"
              />
            )}

            {/* Dégradé + légende + CTA facultatif */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pt-10 pb-3 px-4 pointer-events-none">
              {item.caption && (
                <p className="text-white text-sm font-semibold drop-shadow-md">{item.caption}</p>
              )}
              {onReserve && (
                <button
                  onClick={onReserve}
                  className="pointer-events-auto mt-2 inline-flex items-center bg-[#FF9800] hover:bg-[#F57C00] active:scale-95 transition-all text-white text-xs font-bold px-4 py-2 rounded-full shadow-md"
                >
                  Réserver maintenant →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Flèches (visibles sur écran ≥ sm) */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Média précédent"
            onClick={() => {
              markInteraction();
              goTo(index - 1);
            }}
            className="hidden sm:flex absolute left-2 top-[calc(50%-1rem)] -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white shadow-md text-[#212121]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Média suivant"
            onClick={() => {
              markInteraction();
              goTo(index + 1);
            }}
            className="hidden sm:flex absolute right-2 top-[calc(50%-1rem)] -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white shadow-md text-[#212121]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Points de navigation */}
      {count > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5" role="tablist" aria-label="Navigation du carrousel">
          {MEDIA_ITEMS.map((item, i) => (
            <button
              key={`dot-${item.src}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Aller au média ${i + 1}`}
              onClick={() => {
                markInteraction();
                goTo(i);
              }}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === index ? 'w-5 bg-[#FF9800]' : 'w-2 bg-[#E0E0E0] hover:bg-[#BDBDBD]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
