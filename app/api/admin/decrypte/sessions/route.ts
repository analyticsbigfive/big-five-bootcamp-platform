/**
 * /api/admin/decrypte/sessions
 *
 * GET  : liste toutes les seances (admin).
 * POST : creer une seance.
 *
 * Body POST : {
 *   title: string,
 *   description?: string,
 *   scheduled_at?: string (ISO),
 *   meeting_url?: string,
 *   max_seats?: number | null,
 *   status?: 'draft' | 'open' | 'closed' | 'archived',
 *   campaign_ids?: string[]   // UUID campaigns
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionStatus = 'draft' | 'open' | 'closed' | 'archived'
const STATUS_VALUES: SessionStatus[] = ['draft', 'open', 'closed', 'archived']

function deriveSessionMonth(scheduledAt?: string | null): string {
  const d = scheduledAt ? new Date(scheduledAt) : new Date()
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 7)
  return d.toISOString().slice(0, 7)
}

function tableMissing(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const msg = (error as { message?: string })?.message || ''
  return (
    code === '42P01' || /relation .*decrypte_sessions.* does not exist/i.test(msg)
  )
}

export async function GET() {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('decrypte_sessions')
    .select('*')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({
        sessions: [],
        warning: 'table_missing',
        message:
          "Appliquez scripts/decrypte-sessions.sql pour activer les seances.",
      })
    }
    console.error('[admin/decrypte/sessions] list error', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  // Comptage des inscriptions par seance
  const ids = (data || []).map((s: { id: string }) => s.id)
  const counts: Record<string, number> = {}
  if (ids.length) {
    const { data: regs } = await supabase
      .from('decrypte_registrations')
      .select('session_id')
      .in('session_id', ids)
    ;(regs || []).forEach((r: { session_id: string | null }) => {
      if (r.session_id) counts[r.session_id] = (counts[r.session_id] || 0) + 1
    })
  }

  return NextResponse.json({
    sessions: (data || []).map((s: any) => ({
      ...s,
      registrations_count: counts[s.id] || 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const title = String(body.title || '').trim().slice(0, 200)
  if (!title) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  }

  const status: SessionStatus = STATUS_VALUES.includes(body.status as SessionStatus)
    ? (body.status as SessionStatus)
    : 'draft'

  const scheduledAt = body.scheduled_at ? String(body.scheduled_at) : null
  const sessionMonth = deriveSessionMonth(scheduledAt)
  const campaignIds: string[] = Array.isArray(body.campaign_ids)
    ? body.campaign_ids.filter((v: unknown) => typeof v === 'string')
    : []

  const supabase = getSupabaseAdmin()

  // Snapshot des titres de campagnes
  let campaignTitles: string[] = []
  if (campaignIds.length) {
    const { data: camps } = await supabase
      .from('campaigns')
      .select('id, title')
      .in('id', campaignIds)
    const titleMap = new Map<string, string>(
      (camps || []).map((c: { id: string; title: string }) => [c.id, c.title])
    )
    campaignTitles = campaignIds.map((id: string) => titleMap.get(id) || id)
  }

  const insert = {
    title,
    description: body.description ? String(body.description).slice(0, 4000) : null,
    scheduled_at: scheduledAt,
    session_month: sessionMonth,
    meeting_url: body.meeting_url ? String(body.meeting_url).slice(0, 1000) : null,
    max_seats:
      body.max_seats == null || body.max_seats === ''
        ? null
        : Math.max(0, parseInt(String(body.max_seats), 10) || 0),
    status,
    campaign_ids: campaignIds,
    campaign_titles: campaignTitles,
    notes: body.notes ? String(body.notes).slice(0, 4000) : null,
    created_by: admin.id,
  }

  const { data, error } = await supabase
    .from('decrypte_sessions')
    .insert(insert)
    .select('*')
    .single()

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json(
        {
          error:
            "Table decrypte_sessions absente. Appliquez scripts/decrypte-sessions.sql.",
          code: 'table_missing',
        },
        { status: 500 }
      )
    }
    console.error('[admin/decrypte/sessions] insert error', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, session: data })
}
