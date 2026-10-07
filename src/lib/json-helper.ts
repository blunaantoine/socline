/**
 * Helper pour parser une réponse fetch en JSON de manière sécurisée
 * Évite l'erreur "Unexpected token '<', '<!DOCTYPE'... is not valid JSON"
 *
 * IMPORTANT : les réponses en échec (4xx/5xx) sont AUSSI parsées — les API
 * renvoient { success: false, error: "..." } que les écrans affichent en
 * toast. Si le corps est illisible, un objet d'erreur synthétique est
 * retourné pour ne JAMAIS laisser une action utilisateur sans retour.
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T | null> {
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    const text = await res.text();
    if (text) {
      try {
        return JSON.parse(text) as T;
      } catch {
        // Corps non JSON (page HTML d'erreur, etc.)
      }
    }
    if (!res.ok) {
      // Ne jamais avaler une erreur d'action : objet synthétique exploitable
      // par les écrans (data.success === false → toast.error(data.error)).
      return {
        success: false,
        error: `Erreur serveur (${res.status})`,
      } as T;
    }
    return null;
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}
