/**
 * API Route: /api/brand-requests
 *
 * Gestion des demandes de curation de marques (abonnés Pro)
 *   GET  – liste des demandes de l'utilisateur connecté
 *   POST – création d'une nouvelle demande
 *          body : { brandName, socialNetworks: string[], brandUrls: string[], notes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'
import {
  sendBrandRequestEmail,
  createBrandRequestNotification,
} from '@/lib/brand-request-emails'
import { notifyBrandRequestSubmitted } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// Réseaux sociaux autorisés (whitelist — doit matcher l'UI)
const ALLOWED_SOCIAL_NETWORKS = [
  'facebook',
  'instagram',
  'linkedin',
  'x',
  'tiktok',
] as const
type SocialNetwork = (typeof ALLOWED_SOCIAL_NETWORKS)[number]

// Plans autorisés à soumettre des demandes.
// Le suivi de marques est ouvert à tous les profils (Découverte, Basic, Pro) :
// le service est facturé sur devis, l'utilisateur reconnaît être contacté par LAVEIYE.
const ALLOWED_PLANS = ['discovery', 'basic', 'pro']

// Validation basique d'URL
function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// GET - Lister les demandes de l'utilisateur connecté
export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('brand_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Créer une nouvelle demande
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le plan (Pro minimum) — les admins passent toujours
    const admin = getSupabaseAdmin()
    const { data: profile } = await admin
      .from('users')
      .select('plan, subscription_status, role')
      .eq('id', user.id)
      .single()

    const plan = (profile?.plan || '').toLowerCase()
    const isAdmin = (profile?.role || '').toLowerCase() === 'admin'
    if (!profile || (!isAdmin && !ALLOWED_PLANS.includes(plan))) {
      return NextResponse.json(
        { error: 'Cette fonctionnalité est réservée aux abonnés Pro.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { brandName, socialNetworks, brandUrls, notes, countries, sectors, objective } = body as {
      brandName?: string
      socialNetworks?: unknown
      brandUrls?: unknown
      notes?: string
      countries?: unknown
      sectors?: unknown
      objective?: string
    }

    // 1) Nom de la marque
    if (!brandName || typeof brandName !== 'string' || !brandName.trim()) {
      return NextResponse.json(
        { error: 'Le nom de la marque est requis.' },
        { status: 400 }
      )
    }

    // 2) Réseaux sociaux — cochés
    const socials: SocialNetwork[] = Array.isArray(socialNetworks)
      ? (socialNetworks
          .map((s) => String(s).toLowerCase().trim())
          .filter((s): s is SocialNetwork =>
            (ALLOWED_SOCIAL_NETWORKS as readonly string[]).includes(s)
          ))
      : []

    if (socials.length === 0) {
      return NextResponse.json(
        { error: 'Sélectionnez au moins un réseau social.' },
        { status: 400 }
      )
    }

    // 3) Liens — requis sauf si la marque existe déjà dans les campagnes
    //    (dans ce cas, l'équipe sait où chercher via les campagnes existantes)
    const urlsRaw: string[] = Array.isArray(brandUrls)
      ? brandUrls.map((u) => String(u).trim()).filter(Boolean)
      : []

    const { data: existing } = await admin
      .from('campaigns')
      .select('brand')
      .ilike('brand', brandName.trim())
      .limit(1)
    const brandIsKnown = (existing?.length ?? 0) > 0

    if (urlsRaw.length === 0 && !brandIsKnown) {
      return NextResponse.json(
        { error: 'Au moins un lien est requis pour une nouvelle marque.' },
        { status: 400 }
      )
    }

    const invalid = urlsRaw.find((u) => !isValidUrl(u))
    if (invalid) {
      return NextResponse.json(
        { error: `Lien invalide : ${invalid}` },
        { status: 400 }
      )
    }

    // Champs de contexte — pays et secteurs multiples (whitelistés campagnes publiées)
    const toStringArray = (v: unknown): string[] => {
      if (Array.isArray(v)) {
        const seen = new Set<string>()
        const out: string[] = []
        for (const raw of v) {
          const s = typeof raw === 'string' ? raw.trim() : ''
          if (!s) continue
          const key = s.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          out.push(s)
        }
        return out
      }
      if (typeof v === 'string' && v.trim()) return [v.trim()]
      return []
    }

    const countriesRaw = toStringArray(countries)
    const sectorsRaw = toStringArray(sectors)
    const objectiveClean =
      typeof objective === 'string' && objective.trim() ? objective.trim() : null

    // Pays et secteurs : saisie libre acceptée — l'utilisateur peut suggérer des
    // valeurs hors base. L'équipe LAVEIYE qualifie ensuite la demande côté admin.
    // (Auparavant une whitelist depuis les campagnes publiées rejetait toute
    // valeur inconnue ; supprimée pour autoriser les demandes sur des marchés
    // ou secteurs pas encore référencés dans la plateforme.)

    if (!objectiveClean) {
      return NextResponse.json(
        { error: "L'objectif de la demande est requis." },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('brand_requests')
      .insert({
        user_id: user.id,
        brand_name: brandName.trim(),
        social_networks: socials,
        brand_urls: urlsRaw,
        // Compat avec l'ancienne colonne single-URL (première entrée)
        brand_url: urlsRaw[0] ?? null,
        notes: typeof notes === 'string' ? notes.trim() || null : null,
        // Nouvelles colonnes multi-valeurs
        countries: countriesRaw,
        sectors: sectorsRaw,
        // Compat legacy (première valeur pour les anciens SELECT)
        country: countriesRaw[0] ?? null,
        sector: sectorsRaw[0] ?? null,
        objective: objectiveClean,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notification + email de confirmation (non bloquant)
    if (data?.id) {
      Promise.all([
        createBrandRequestNotification({
          userId: user.id,
          brandRequestId: data.id,
          brandName: data.brand_name,
          kind: 'submission_received',
        }),
        sendBrandRequestEmail({
          userId: user.id,
          kind: 'submission_received',
          brandName: data.brand_name,
        }),
        notifyBrandRequestSubmitted({
          userId: user.id,
          brandName: data.brand_name,
          brandRequestId: data.id,
          brandCountry: countriesRaw[0] ?? null,
          brandSector: sectorsRaw[0] ?? null,
          notes: typeof notes === 'string' ? notes.trim() || null : null,
        }),
      ]).catch((e) => console.error('[brand-requests] post-submit notify failed:', e))
    }

    return NextResponse.json({ request: data })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
