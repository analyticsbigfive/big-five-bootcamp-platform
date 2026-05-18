/**
 * GET /api/decrypte/sessions
 *
 * Liste des seances #BigFiveDecrypte ouvertes a l'inscription
 * (status = 'open'). Reservee aux utilisateurs Pro authentifies.
 * Renvoie egalement les seances 'closed' (visibles mais fermees) pour info.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { resolveTier } from '@/lib/quotas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseServer = await getSupabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // Verification du plan Pro (gating)
  const { data: profile } = await admin
    .from('users')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single<{ plan: string | null; subscription_status: string | null }>()

  const tier = resolveTier(profile?.plan, profile?.subscription_status)
  if (tier !== 'pro') {
    return NextResponse.json(
      { error: 'Plan Pro requis', currentTier: tier, sessions: [] },
      { status: 403 }
    )
  }

  const { data, error } = await admin
    .from('decrypte_sessions')
    .select(
      'id, title, description, scheduled_at, session_month, meeting_url, max_seats, status, campaign_ids, campaign_titles'
    )
    .in('status', ['open', 'closed'])
    .order('scheduled_at', { ascending: true, nullsFirst: false })

  if (error) {
    const errCode = (error as { code?: string }).code
    const errMsg = (error as { message?: string }).message || ''
    if (
      errCode === '42P01' ||
      /relation .*decrypte_sessions.* does not exist/i.test(errMsg)
    ) {
      return NextResponse.json({
        sessions: [],
        warning: 'table_missing',
        message:
          "La table decrypte_sessions n'existe pas. Appliquez scripts/decrypte-sessions.sql.",
      })
    }
    console.error('[decrypte/sessions] error:', error)
    return NextResponse.json({ error: errMsg || 'Erreur DB' }, { status: 500 })
  }

  // Inscriptions de l'utilisateur (pour griser les seances deja prises)
  const { data: regs } = await admin
    .from('decrypte_registrations')
    .select('session_id')
    .eq('user_id', user.id)
    .not('session_id', 'is', null)

  const registeredSessionIds = new Set(
    (regs || []).map((r: { session_id: string }) => r.session_id)
  )

  // Comptage des inscriptions par seance (pour afficher seats restants)
  const sessionIds = (data || []).map((s: { id: string }) => s.id)
  let counts: Record<string, number> = {}
  if (sessionIds.length) {
    const { data: countRows } = await admin
      .from('decrypte_registrations')
      .select('session_id')
      .in('session_id', sessionIds)
    ;(countRows || []).forEach((r: { session_id: string | null }) => {
      if (r.session_id) counts[r.session_id] = (counts[r.session_id] || 0) + 1
    })
  }

  return NextResponse.json({
    sessions: (data || []).map((s: any) => ({
      ...s,
      registered: registeredSessionIds.has(s.id),
      seats_taken: counts[s.id] || 0,
      seats_remaining:
        s.max_seats == null ? null : Math.max(0, s.max_seats - (counts[s.id] || 0)),
    })),
  })
}
