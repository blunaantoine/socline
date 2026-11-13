/**
 * Géolocalisation précise — source unique pour toute l'app.
 *
 * Un seul `getCurrentPosition` renvoie souvent un premier point grossier
 * (Wi-Fi / antenne, ± 500 m) avant que le GPS se cale. Ici on ÉCOUTE le GPS
 * quelques secondes (`watchPosition`, haute précision, jamais de cache) et on
 * garde le meilleur point : on s'arrête dès qu'il est assez précis, sinon on
 * rend le meilleur obtenu à la fin du délai.
 */

export interface PrecisePosition {
  latitude: number;
  longitude: number;
  /** Rayon d'incertitude en mètres (plus petit = plus précis). */
  accuracy: number;
}

export type GeoErrorReason = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  reason: GeoErrorReason;
  constructor(reason: GeoErrorReason) {
    super(GEO_ERROR_MESSAGES[reason]);
    this.reason = reason;
  }
}

/** Messages prêts à afficher (en français) pour chaque cause d'échec. */
export const GEO_ERROR_MESSAGES: Record<GeoErrorReason, string> = {
  unsupported: "La localisation n'est pas disponible sur cet appareil.",
  denied: "Localisation refusée : autorisez-la pour Socline dans les réglages du téléphone (« Position exacte »).",
  unavailable: 'Position introuvable : activez la localisation (GPS) du téléphone.',
  timeout: 'Le GPS met trop de temps à répondre. Réessayez à l’extérieur ou touchez la carte.',
};

export function getPrecisePosition({
  maxWaitMs = 10000,
  goodAccuracy = 30,
}: { maxWaitMs?: number; goodAccuracy?: number } = {}): Promise<PrecisePosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeoError('unsupported'));
      return;
    }

    let best: PrecisePosition | null = null;
    let done = false;
    let watchId: number | null = null;

    const finish = (error?: GeoError) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (best) resolve(best);
      else reject(error ?? new GeoError('timeout'));
    };

    const timer = setTimeout(() => finish(), maxWaitMs);

    const consider = (pos: GeolocationPosition) => {
      if (done) return;
      const p = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? Infinity,
      };
      if (!best || p.accuracy < best.accuracy) best = p;
      if (best.accuracy <= goodAccuracy) finish();
    };

    // Point de départ : la dernière position connue du téléphone (≤ 10 s).
    // Utile quand le GPS est déjà utilisé ailleurs dans l'app (une seconde
    // écoute peut ne rien recevoir tant que l'appareil ne bouge pas). On
    // continue ensuite d'écouter pour trouver un point plus précis.
    navigator.geolocation.getCurrentPosition(consider, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: maxWaitMs,
    });

    watchId = navigator.geolocation.watchPosition(
      consider,
      (err) => {
        // Refus de permission : inutile d'attendre. Les autres erreurs peuvent
        // être passagères (le GPS cherche encore) : on laisse courir le délai.
        if (err.code === err.PERMISSION_DENIED) finish(new GeoError('denied'));
        else if (err.code === err.POSITION_UNAVAILABLE && !best) finish(new GeoError('unavailable'));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    );
  });
}

/** Libellé court de la précision, ex. « ± 12 m » / « ± 1,2 km ». */
export function formatAccuracy(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `± ${Math.round(meters)} m`;
  return `± ${(meters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}
