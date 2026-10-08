// Utilitaire partagé : compresse / redimensionne une image côté navigateur
// et renvoie un Data URL JPEG. Utilisé pour les photos de station (devanture),
// évitant de stocker d'énormes chaînes base64 dans SQLite.
export function fileToCompressedDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const fallbackRawRead = () => {
      // Fallback : lecture brute du fichier (formats non décodables par canvas)
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Image illisible'));
      reader.readAsDataURL(file);
    };
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas indisponible');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        cleanup();
        fallbackRawRead();
      }
    };
    img.onerror = () => {
      cleanup();
      fallbackRawRead();
    };
    img.src = objectUrl;
  });
}

// Construit l'URL Google Maps « itinéraire » vers une station.
// Utilise les coordonnées GPS si disponibles, sinon l'adresse textuelle.
export function buildStationDirectionsUrl(
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null
): string {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address || ''
  )}&travelmode=driving`;
}
