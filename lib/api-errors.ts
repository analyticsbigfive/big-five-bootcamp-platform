/**
 * Helpers pour les réponses d'erreur API.
 *
 * Objectif : ne JAMAIS renvoyer `error.message` brut Supabase/Postgres au
 * client en production (fuite de schéma, noms de colonnes, contraintes).
 * En dev, on garde les détails pour le debug.
 */

/**
 * Renvoie `value` si on est en dev, `undefined` sinon. À utiliser dans les
 * payloads JSON pour des champs `details` / `message` issus d'exceptions ou
 * de réponses Supabase.
 */
export function devOnly<T>(value: T): T | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  return value
}

/**
 * Extrait un message d'erreur sûr depuis une exception. En prod : message
 * générique. En dev : le vrai message.
 */
export function safeErrorMessage(err: unknown, fallback = 'Erreur serveur'): string {
  if (process.env.NODE_ENV === 'production') return fallback
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}
