import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'

// Clés dont la valeur doit être masquée en lecture
const SENSITIVE_KEYS = ['mailchimp_api_key']

// GET - Récupérer tous les paramètres du site
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value, description')

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 })
    }

    // Transformer en objet clé-valeur
    const settings: Record<string, string> = {}
    data?.forEach((row: { key: string; value: string }) => {
      if (SENSITIVE_KEYS.includes(row.key) && row.value) {
        // Déchiffrer puis masquer la clé API pour l'affichage
        const decrypted = isEncrypted(row.value) ? decrypt(row.value) : row.value
        if (decrypted) {
          // Masquer : afficher seulement les 4 derniers caractères
          settings[row.key] = '••••••••••••' + decrypted.slice(-4)
        } else {
          settings[row.key] = ''
        }
      } else {
        settings[row.key] = row.value
      }
    })

    return NextResponse.json({ settings })
  } catch (err) {
    console.error('Settings GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Mettre à jour un ou plusieurs paramètres
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    // Vérifier que l'utilisateur est admin (via session)
    const { getSupabaseServer } = await import('@/lib/supabase-server')
    const supabaseServer = await getSupabaseServer()
    const { data: { user } } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le rôle admin (liste centralisée dans lib/admin-auth)
    const { ADMIN_EMAILS } = await import('@/lib/admin-auth')
    const isAdmin = user.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())

    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

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
        console.error(`Error updating setting ${key}:`, error)
        throw error
      }
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Settings PUT error:', err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}
