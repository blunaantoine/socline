/**
 * Safe Fetch Utilities
 * Gestion sécurisée des requêtes API pour éviter les erreurs de parsing JSON
 */

/**
 * Effectue une requête fetch et parse la réponse JSON de manière sécurisée
 * Évite l'erreur "Unexpected token '<', '<!DOCTYPE'... is not valid JSON"
 */
export async function safeFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    
    // Vérifier si la réponse est OK
    if (!res.ok) {
      // Essayer de parser l'erreur JSON, sinon utiliser le statusText
      let errorMsg = `Erreur ${res.status}: ${res.statusText}`;
      try {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        }
      } catch {
        // Ignorer les erreurs de parsing
      }
      return { ok: false, status: res.status, data: null, error: errorMsg };
    }
    
    // Vérifier le content-type avant de parser
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Si ce n'est pas du JSON, essayer de parser quand même mais avec try/catch
      try {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        return { ok: true, status: res.status, data: data as T };
      } catch {
        return { 
          ok: false, 
          status: res.status, 
          data: null, 
          error: 'Réponse non-JSON reçue' 
        };
      }
    }
    
    // Parser le JSON normalement
    const data = await res.json() as T;
    return { ok: true, status: res.status, data };
  } catch (error) {
    console.error('Fetch error:', error);
    return { 
      ok: false, 
      status: 0, 
      data: null, 
      error: error instanceof Error ? error.message : 'Erreur réseau' 
    };
  }
}

/**
 * Version simplifiée qui retourne directement les données ou null
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  const result = await safeFetch<T>(url, options);
  return result.data;
}
