/**
 * Helpers pour sanitizer les inputs de recherche utilisés dans les
 * filtres PostgREST (`.ilike(...)`, `.or(...)`).
 *
 * Problème : PostgREST interprète la chaîne `.or()` comme une expression
 * (séparateur `,`), et `ilike` interprète `%` / `_` comme wildcards SQL.
 * Si on interpole bêtement `${search}`, l'utilisateur peut :
 *   - `,` casser la syntaxe `.or()` → conditions inattendues
 *   - `%` matcher tout / `_` matcher un char arbitraire
 *   - `\` désaligner l'escape
 *
 * `escapeForIlike` neutralise ces caractères côté entrée.
 */

/**
 * Échappe les caractères dangereux dans une chaîne destinée à un `.ilike()`
 * ou à un fragment `.or()` PostgREST.
 *
 * Échappe : `%`, `_`, `\`, `,`, `(`, `)`, `*`, `:`, `"`.
 */
export function escapeForIlike(input: string): string {
  return String(input || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, ' ')
    .replace(/[()*:"]/g, ' ')
    .trim()
}
