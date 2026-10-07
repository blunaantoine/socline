// Shared geo helpers — Haversine great-circle distance.
// Used by the order dispatch (pending pool sorted by proximity) and the
// nearby-washers listing.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Distance in km between two WGS84 points (Haversine formula).
 * Returns null when any coordinate is missing/invalid.
 */
export function calculateDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (
    typeof lat1 !== 'number' || !isFinite(lat1) ||
    typeof lon1 !== 'number' || !isFinite(lon1) ||
    typeof lat2 !== 'number' || !isFinite(lat2) ||
    typeof lon2 !== 'number' || !isFinite(lon2)
  ) {
    return null;
  }

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
