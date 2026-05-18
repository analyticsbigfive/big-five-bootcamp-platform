/**
 * /api/admin/decrypte/sessions/[id]
 *
 * GET    : detail d'une seance
 * PUT    : mise a jour partielle
 * DELETE : suppression (les inscriptions liees passent session_id=NULL)
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('decrypte_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'Seance introuvable' }, { status: 404 })
  }

  const { count } = await supabase
    .from('decrypte_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', id)

  return NextResponse.json({
    session: { ...(data as object), registrations_count: count || 0 },
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  const { id } = await params

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string') update.title = body.title.trim().slice(0, 200)
  if ('description' in body)
    update.description = body.description ? String(body.description).slice(0, 4000) : null
  if ('scheduled_at' in body) {
    const scheduledAt = body.scheduled_at ? String(body.scheduled_at) : null
    update.scheduled_at = scheduledAt
    update.session_month = deriveSessionMonth(scheduledAt)
  }
  if ('meeting_url' in body)
    update.meeting_url = body.meeting_url ? String(body.meeting_url).slice(0, 1000) : null
  if ('max_seats' in body) {
    update.max_seats =
      body.max_seats == null || body.max_seats === ''
        ? null
        : Math.max(0, parseInt(String(body.max_seats), 10) || 0)
  }
  if (typeof body.status === 'string' && STATUS_VALUES.includes(body.status as SessionStatus)) {
    update.status = body.status
  }
  if (Array.isArray(body.campaign_ids)) {
    const campaignIds: string[] = body.campaign_ids.filter(
      (v: unknown) => typeof v === 'string'
    )
    update.campaign_ids = campaignIds
    if (campaignIds.length) {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, title')
        .in('id', campaignIds)
      const titleMap = new Map<string, string>(
        (camps || []).map((c: { id: string; title: string }) => [c.id, c.title])
      )
      update.campaign_titles = campaignIds.map((cid) => titleMap.get(cid) || cid)
    } else {
      update.campaign_titles = []
    }
  }
  if ('notes' in body)
    update.notes = body.notes ? String(body.notes).slice(0, 4000) : null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('decrypte_sessions')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/decrypte/sessions PUT]', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, session: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('decrypte_sessions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[admin/decrypte/sessions DELETE]', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
