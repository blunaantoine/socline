/**
 * Helper pour parser une réponse fetch en JSON de manière sécurisée
 * Évite l'erreur "Unexpected token '<', '<!DOCTYPE'... is not valid JSON"
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T | null> {
  try {
    if (!res.ok) {
      return null;
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    }
    return await res.json() as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}
