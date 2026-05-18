/**
 * Sanitizer HTML minimal pour bloquer les vecteurs XSS dans les contenus
 * rendus via `dangerouslySetInnerHTML`. Pas un remplacement complet de
 * DOMPurify, mais couvre les vecteurs courants en attendant l'install.
 *
 * Ce module supprime :
 *   - balises <script>, <iframe>, <object>, <embed>, <style>, <link>, <meta>, <base>, <form>
 *   - attributs `on*` (onerror, onclick, onload...)
 *   - URLs `javascript:` / `data:` (sauf `data:image/...`)
 *   - balises auto-fermantes potentiellement injectables (<svg>, <math>)
 *
 * À utiliser sur tout HTML d'origine admin avant rendu côté client.
 * Quand `isomorphic-dompurify` sera installé, remplacer par DOMPurify.
 */

const BLOCKED_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'link',
  'meta',
  'base',
  'form',
  'svg',
  'math',
]

const DANGEROUS_URL = /^\s*(javascript|vbscript|file):/i

/**
 * Nettoie un HTML potentiellement hostile et renvoie une chaîne sûre à
 * injecter via `dangerouslySetInnerHTML`. L'entrée non-string est convertie
 * en chaîne vide pour éviter `[object Object]` ou exceptions.
 */
export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string' || !input) return ''

  let out = input

  // Strip balises dangereuses et leur contenu (script/style/iframe/object/embed/svg/math).
  // Pour les balises sans contenu (link/meta/base), on retire juste la balise auto-fermante.
  for (const tag of BLOCKED_TAGS) {
    // Avec contenu : <script ...>...</script>
    out = out.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
      ''
    )
    // Auto-fermante ou sans </tag> : <script ...>, <meta ...>, <link ... />
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  // Strip tous les handlers `on*=...` (quoted ou non).
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, '')
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '')

  // Strip href/src "javascript:..." (autorise data:image/... pour les images inline).
  out = out.replace(
    /(\s(?:href|src|xlink:href|action|formaction)\s*=\s*)("|')(.*?)(\2)/gi,
    (match, prefix: string, quote: string, value: string) => {
      const v = String(value || '').trim()
      if (DANGEROUS_URL.test(v)) return ''
      // data: URLs : on autorise uniquement les images inline
      if (/^\s*data:/i.test(v) && !/^\s*data:image\//i.test(v)) return ''
      return `${prefix}${quote}${value}${quote}`
    }
  )

  return out
}
