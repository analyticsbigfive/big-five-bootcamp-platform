/**
 * POST /api/admin/decrypte/sync
 *
 * (Re)synchronise les inscriptions #BigFiveDecrypte vers Mailchimp,
 * en utilisant l'audience configuree dans Admin > Mailchimp
 * (cle site_settings: mailchimp_decrypte_audience_id ; fallback audience principale).
 *
 * Body : { onlyFailed?: boolean, ids?: string[], month?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getMailchimpService } from '@/lib/mailchimp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  let body: { onlyFailed?: boolean; ids?: string[]; month?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body ok */
  }

  const supabase = getSupabaseAdmin()

  // Settings decrypte
  const { data: settings } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['mailchimp_decrypte_audience_id', 'mailchimp_decrypte_tag'])
  const map: Record<string, string> = {}
  settings?.forEach((row: { key: string; value: string }) => (map[row.key] = row.value))
  const audienceId = (map['mailchimp_decrypte_audience_id'] || '').trim()
  const decrypteTag = (map['mailchimp_decrypte_tag'] || 'bigfive-decrypte').trim()

  // Selection
  let query = supabase
    .from('decrypte_registrations')
    .select(
      'id, email, full_name, phone, company, job_title, topics_of_interest, session_month, mailchimp_status'
    )

  if (Array.isArray(body.ids) && body.ids.length) {
    query = query.in('id', body.ids)
  } else {
    if (body.onlyFailed) {
      query = query.or('mailchimp_status.is.null,mailchimp_status.neq.subscribed')
    }
    if (body.month) {
      query = query.eq('session_month', body.month)
    }
  }

  const { data: rows, error } = await query
  if (error) {
    console.error('[admin/decrypte/sync] DB error:', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  // Verifier la config Mailchimp AVANT de boucler
  const service = getMailchimpService()
  let config
  try {
    config = await service.loadConfig()
  } catch (err: any) {
    console.error('[admin/decrypte/sync] loadConfig error:', err)
    return NextResponse.json(
      { error: `Config Mailchimp illisible : ${err?.message || 'erreur'}` },
      { status: 500 }
    )
  }

  if (!config.apiKey) {
    return NextResponse.json(
      {
        error:
          'Cle API Mailchimp non configuree. Renseignez-la dans Admin > Mailchimp.',
      },
      { status: 400 }
    )
  }

  const effectiveAudienceId = audienceId || config.audienceId
  if (!effectiveAudienceId) {
    return NextResponse.json(
      {
        error:
          "Aucune audience Mailchimp configuree. Renseignez 'Audience #BigFiveDecrypte' (ou l'audience principale) dans Admin > Mailchimp.",
      },
      { status: 400 }
    )
  }

  let synced = 0
  const errors: { email: string; error: string }[] = []

  for (const r of (rows || []) as Array<{
    id: string
    email: string
    full_name: string | null
    phone: string | null
    company: string | null
    job_title: string | null
    topics_of_interest: string | null
    session_month: string
  }>) {
    if (!r.email) {
      errors.push({ email: '(vide)', error: 'Email manquant' })
      continue
    }

    const fullName = (r.full_name || '').trim()
    const [firstName, ...rest] = fullName.split(/\s+/)
    const lastName = rest.join(' ')

    const res = await service.upsertMember({
      email: r.email,
      audienceId: effectiveAudienceId,
      mergeFields: {
        FNAME: firstName || fullName,
        LNAME: lastName,
        COMPANY: r.company || '',
        JOBTITLE: r.job_title || '',
        TOPICS: r.topics_of_interest || '',
        PHONE: r.phone || '',
        SESSION: r.session_month || '',
      },
      tags: [decrypteTag, `decrypte-${r.session_month}`].filter(Boolean),
    })

    if (res.ok) {
      synced++
      await supabase
        .from('decrypte_registrations')
        .update({
          mailchimp_status: 'subscribed',
          mailchimp_synced_at: new Date().toISOString(),
          mailchimp_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id)
    } else {
      errors.push({ email: r.email, error: res.error })
      await supabase
        .from('decrypte_registrations')
        .update({
          mailchimp_status: 'error',
          mailchimp_synced_at: new Date().toISOString(),
          mailchimp_error: res.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id)
    }
  }

  return NextResponse.json({
    ok: true,
    total: rows?.length || 0,
    synced,
    errors,
    audienceId: effectiveAudienceId,
    usingMainAudience: !audienceId,
  })
}
