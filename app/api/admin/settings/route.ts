import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'
import { ADMIN_EMAILS } from '@/lib/admin-auth'

// Routes admin : pas de cache, runtime Node.js (pour `node:crypto`).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Clés dont la valeur doit être masquée en lecture
const SENSITIVE_KEYS = ['mailchimp_api_key']

async function ensureAdmin() {
  const supabaseServer = await getSupabaseServer()
  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  const isAdmin = user.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())
  if (!isAdmin) {
    return { ok: false as const, response: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) }
  }
  return { ok: true as const, user }
}

// GET - Récupérer tous les paramètres du site
export async function GET() {
  try {
    const auth = await ensureAdmin()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value, description')

    if (error) {
      console.error('[admin/settings GET] supabase error:', error)
      return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 })
    }

    // Transformer en objet clé-valeur, en isolant les erreurs par ligne pour
    // qu'une seule valeur corrompue ne fasse pas planter toute la page.
    const settings: Record<string, string> = {}
    const warnings: string[] = []

    data?.forEach((row: { key: string; value: string }) => {
      try {
        if (SENSITIVE_KEYS.includes(row.key) && row.value) {
          if (isEncrypted(row.value)) {
            const decrypted = decrypt(row.value)
            if (decrypted) {
              // Masquer : afficher seulement les 4 derniers caractères
              settings[row.key] = '••••••••••••' + decrypted.slice(-4)
            } else {
              // Déchiffrement échoué — on signale au front avec un marqueur
              // explicite plutôt qu'une valeur vide silencieuse.
              settings[row.key] = ''
              warnings.push(`${row.key}: déchiffrement impossible (resaisir la valeur)`)
            }
          } else {
            // Valeur stockée en clair (legacy) : masquer pareillement.
            settings[row.key] = '••••••••••••' + row.value.slice(-4)
          }
        } else {
          settings[row.key] = row.value
        }
      } catch (rowErr) {
        console.error(`[admin/settings GET] row "${row.key}" error:`, rowErr)
        settings[row.key] = ''
        warnings.push(`${row.key}: erreur de lecture`)
      }
    })

    return NextResponse.json({ settings, warnings })
  } catch (err) {
    console.error('[admin/settings GET] unexpected error:', err)
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Erreur serveur'
        : (err as Error)?.message || 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT - Mettre à jour un ou plusieurs paramètres
export async function PUT(request: NextRequest) {
  try {
    const auth = await ensureAdmin()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()

    const { settings } = await request.json() as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // Mettre à jour chaque paramètre (chiffrer les clés sensibles)
    const updates = Object.entries(settings).map(async ([key, value]) => {
      let finalValue = value

      // Chiffrer la clé API Mailchimp avant stockage
      if (key === 'mailchimp_api_key' && value) {
        // Si la valeur commence par •, c'est la valeur masquée — ne pas écraser
        if (value.startsWith('•')) {
          return // Ne pas mettre à jour, garder la valeur existante
        }

        const normalized = value.trim()
        const isValidMailchimpKey = /-[a-z]{2}\d{1,3}$/i.test(normalized)
        if (!isValidMailchimpKey) {
          throw new Error('Clé API Mailchimp invalide (format attendu: xxxxx-us14)')
        }
        finalValue = encrypt(normalized)
      }

      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key, value: finalValue, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      if (error) {
        console.error(`[admin/settings PUT] upsert ${key}:`, error)
        throw error
      }
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/settings PUT] error:', err)
    const message = (err as Error)?.message || 'Erreur lors de la sauvegarde'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
