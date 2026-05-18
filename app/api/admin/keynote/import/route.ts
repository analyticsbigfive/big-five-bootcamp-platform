/**
 * POST /api/admin/keynote/import
 *
 * Synchronisation bidirectionnelle keynote : importe les membres d'une
 * audience Mailchimp (typiquement l'audience keynote) vers la table
 * `keynote_registrations`.
 *
 * Cas d'usage : des codes promo ont été distribués hors-système (manuellement,
 * via une campagne, etc.). On veut quand même que les destinataires puissent
 * les redeemer sur /subscribe. L'import :
 *   - crée une `keynote_registrations` pour chaque email Mailchimp absent
 *     de la table ;
 *   - récupère un code promo soit depuis le merge field `PROMO` Mailchimp
 *     (préféré : préserve le code distribué hors-système), soit en génère
 *     un neuf si absent ;
 *   - laisse intactes les inscriptions existantes (idempotent).
 *
 * Body : { audienceId?: string }  (sinon audience keynote des settings)
 *
 * Sécurité : admin uniquement (`checkAdmin`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getMailchimpService } from '@/lib/mailchimp'
import { generatePromoCode, isPromoCodeFormatValid, normalizePromoCode } from '@/lib/promo-codes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Limite la pagination Mailchimp à un nombre raisonnable d'appels.
// 100 membres × 50 pages = 5 000 membres max par import. Suffisant pour
// un keynote ; au-delà, on doit relancer.
const MAILCHIMP_PAGE_SIZE = 100
const MAX_PAGES = 50

interface MailchimpMember {
  id: string
  email_address: string
  status: string
  merge_fields?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  let body: { audienceId?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* body optionnel */
  }

  const supabase = getSupabaseAdmin()

  // Résolution audience cible
  const { data: settings } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['mailchimp_keynote_audience_id'])
  const settingsMap: Record<string, string> = {}
  settings?.forEach((row: { key: string; value: string }) => {
    settingsMap[row.key] = row.value
  })

  const service = getMailchimpService()
  let config
  try {
    config = await service.loadConfig()
  } catch (err: any) {
    return NextResponse.json(
      { error: `Config Mailchimp illisible : ${err?.message || 'erreur'}` },
      { status: 500 }
    )
  }

  if (!config.apiKey) {
    return NextResponse.json(
      { error: 'Clé API Mailchimp non configurée.' },
      { status: 400 }
    )
  }

  const audienceId = (body.audienceId || settingsMap['mailchimp_keynote_audience_id'] || config.audienceId || '').trim()
  if (!audienceId) {
    return NextResponse.json(
      { error: 'Aucune audience Mailchimp configurée (keynote ou principale).' },
      { status: 400 }
    )
  }

  // Extraction du data center depuis la clé API
  const dcMatch = config.apiKey.match(/-([a-z]{2}\d{1,3})$/i)
  if (!dcMatch) {
    return NextResponse.json(
      { error: 'Clé API Mailchimp invalide (data center introuvable).' },
      { status: 400 }
    )
  }
  const baseUrl = `https://${dcMatch[1].toLowerCase()}.api.mailchimp.com/3.0`

  // Index des emails déjà connus côté plateforme (single query, pas de N+1)
  const { data: existing } = await supabase
    .from('keynote_registrations')
    .select('email, promo_code')
  const knownEmails = new Set<string>()
  const knownCodes = new Set<string>()
  for (const row of (existing || []) as Array<{ email: string; promo_code: string | null }>) {
    if (row.email) knownEmails.add(row.email.toLowerCase())
    if (row.promo_code) knownCodes.add(row.promo_code)
  }

  let imported = 0
  let skipped = 0
  let pagesFetched = 0
  const errors: { email: string; error: string }[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * MAILCHIMP_PAGE_SIZE
    const url = `${baseUrl}/lists/${audienceId}/members?count=${MAILCHIMP_PAGE_SIZE}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `apikey ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Erreur réseau Mailchimp : ${err?.message || 'erreur'}`, imported, skipped },
        { status: 502 }
      )
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: `Mailchimp HTTP ${response.status} : ${errData.detail || 'erreur'}`,
          imported,
          skipped,
        },
        { status: 502 }
      )
    }

    const payload = await response.json()
    const members: MailchimpMember[] = payload.members || []
    pagesFetched++

    if (members.length === 0) break

    for (const m of members) {
      const email = (m.email_address || '').toLowerCase().trim()
      if (!email) {
        skipped++
        continue
      }
      // Skip si l'inscription existe déjà — idempotent.
      if (knownEmails.has(email)) {
        skipped++
        continue
      }
      // Skip Mailchimp-unsubscribed/cleaned (on ne crée pas de
      // promo pour quelqu'un qui s'est désinscrit).
      if (m.status === 'unsubscribed' || m.status === 'cleaned') {
        skipped++
        continue
      }

      const merge = m.merge_fields || {}
      let promoCode = normalizePromoCode(merge.PROMO)

      // Si Mailchimp n'a pas de PROMO valide, on génère un code neuf
      // unique (par rapport aux codes déjà connus + nouveaux générés).
      if (!promoCode || !isPromoCodeFormatValid(promoCode) || knownCodes.has(promoCode)) {
        let candidate = generatePromoCode()
        for (let attempt = 0; attempt < 10 && knownCodes.has(candidate); attempt++) {
          candidate = generatePromoCode()
        }
        promoCode = candidate
      }

      const firstName = String(merge.FNAME || '').slice(0, 60)
      const lastName = String(merge.LNAME || '').slice(0, 60)
      const country = String(merge.COUNTRY || '').slice(0, 60)

      const { error: insertErr } = await supabase.from('keynote_registrations').insert({
        email,
        first_name: firstName,
        last_name: lastName,
        country,
        promo_code: promoCode,
        source: 'mailchimp-import',
        mailchimp_status: 'subscribed',
        mailchimp_synced_at: new Date().toISOString(),
      })

      if (insertErr) {
        const code = (insertErr as { code?: string }).code
        if (code === '23505') {
          skipped++
          continue
        }
        errors.push({
          email,
          error: (insertErr as { message?: string }).message || 'erreur insert',
        })
        continue
      }

      knownEmails.add(email)
      knownCodes.add(promoCode)
      imported++
    }

    // Fin de pagination si on a reçu moins que page_size
    if (members.length < MAILCHIMP_PAGE_SIZE) break
  }

  return NextResponse.json({
    ok: true,
    audienceId,
    pagesFetched,
    imported,
    skipped,
    errors,
  })
}
