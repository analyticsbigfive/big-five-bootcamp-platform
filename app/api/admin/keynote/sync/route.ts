import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getMailchimpService } from '@/lib/mailchimp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST — (Re)synchroniser les inscrits keynote vers Mailchimp.
// Body: { onlyFailed?: boolean, ids?: string[] }
export async function POST(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  let body: { onlyFailed?: boolean; ids?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body ok */
  }

  const supabase = getSupabaseAdmin()

  // Settings keynote
  const { data: settings } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['mailchimp_keynote_audience_id', 'mailchimp_keynote_tag', 'mailchimp_keynote_promo_tag'])
  const map: Record<string, string> = {}
  settings?.forEach((row: { key: string; value: string }) => (map[row.key] = row.value))
  const audienceId = (map['mailchimp_keynote_audience_id'] || '').trim()
  const keynoteTag = (map['mailchimp_keynote_tag'] || 'keynote-2026').trim()
  const promoTag = (map['mailchimp_keynote_promo_tag'] || 'promo-pre-launch').trim()

  if (process.env.NODE_ENV !== 'production') {
    console.log('[keynote/sync] settings read', {
      rowCount: settings?.length || 0,
      keys: settings?.map((s: { key: string }) => s.key) || [],
      audienceId: audienceId || '(empty)',
      keynoteTag,
      promoTag,
    })
  }

  // Liste à synchroniser
  let query = supabase
    .from('keynote_registrations')
    .select('id, email, first_name, last_name, country, promo_code, mailchimp_status')

  if (Array.isArray(body.ids) && body.ids.length) {
    query = query.in('id', body.ids)
  } else if (body.onlyFailed) {
    query = query.or('mailchimp_status.is.null,mailchimp_status.neq.subscribed')
  }

  const { data: rows, error } = await query
  if (error) {
    console.error('[keynote/sync] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Vérifier la config Mailchimp AVANT de boucler — message clair sinon
  const service = getMailchimpService()
  let config
  try {
    config = await service.loadConfig()
  } catch (err: any) {
    console.error('[keynote/sync] loadConfig error:', err)
    return NextResponse.json(
      { error: `Config Mailchimp illisible : ${err?.message || 'erreur'}` },
      { status: 500 }
    )
  }

  if (!config.apiKey) {
    return NextResponse.json(
      {
        error:
          'Clé API Mailchimp non configurée. Renseignez-la dans Admin → Mailchimp.',
      },
      { status: 400 }
    )
  }

  const effectiveAudienceId = audienceId || config.audienceId
  if (!effectiveAudienceId) {
    return NextResponse.json(
      {
        error:
          "Aucune audience Mailchimp configurée. Renseignez 'Audience Keynote' (ou l'audience principale) dans Admin → Mailchimp.",
      },
      { status: 400 }
    )
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[keynote/sync] Starting sync', {
      rows: rows?.length || 0,
      audienceId: effectiveAudienceId,
      keynoteTag,
      promoTag,
      usingMainAudience: !audienceId,
    })
  }

  let synced = 0
  const errors: { email: string; error: string }[] = []

  for (const r of rows || []) {
    if (!r.email) {
      errors.push({ email: '(vide)', error: 'Email manquant' })
      continue
    }

    const res = await service.upsertMember({
      email: r.email,
      audienceId: effectiveAudienceId,
      mergeFields: {
        FNAME: r.first_name || '',
        LNAME: r.last_name || '',
        COUNTRY: r.country || '',
        PROMO: r.promo_code || '',
      },
      tags: [keynoteTag, promoTag].filter(Boolean),
    })

    if (res.ok) {
      synced++
      await supabase
        .from('keynote_registrations')
        .update({
          mailchimp_status: 'subscribed',
          mailchimp_synced_at: new Date().toISOString(),
          mailchimp_error: null,
        })
        .eq('id', r.id)
    } else {
      console.error('[keynote/sync] upsert failed', { email: r.email, error: res.error })
      errors.push({ email: r.email, error: res.error })
      await supabase
        .from('keynote_registrations')
        .update({
          mailchimp_status: 'error',
          mailchimp_synced_at: new Date().toISOString(),
          mailchimp_error: res.error,
        })
        .eq('id', r.id)
    }
  }

  console.log('[keynote/sync] Done', { total: rows?.length || 0, synced, errors: errors.length })

  return NextResponse.json({
    ok: true,
    total: rows?.length || 0,
    synced,
    errors,
    audienceId: effectiveAudienceId,
    usingMainAudience: !audienceId,
  })
}
