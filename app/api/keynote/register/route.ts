import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getMailchimpService } from '@/lib/mailchimp'
import { generatePromoCode } from '@/lib/promo-codes'
import { isBlockedEmail } from '@/lib/disposable-emails'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Payload {
  firstName?: string
  lastName?: string
  email?: string
  country?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getKeynoteSettings() {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'mailchimp_keynote_audience_id',
      'mailchimp_keynote_tag',
      'mailchimp_keynote_promo_tag',
    ])
  const map: Record<string, string> = {}
  data?.forEach((row: { key: string; value: string }) => {
    map[row.key] = row.value
  })
  return {
    audienceId: map['mailchimp_keynote_audience_id'] || '',
    keynoteTag: map['mailchimp_keynote_tag'] || 'keynote-2026',
    promoTag: map['mailchimp_keynote_promo_tag'] || 'promo-pre-launch',
  }
}

export async function POST(request: NextRequest) {
  // Anti-spam : 5 inscriptions / 10 min par IP. Le doublon par email est
  // déjà géré ci-dessous ; ce rate-limit bloque les bots qui essaient des
  // emails jetables différents en boucle.
  const ip = getClientIp(request)
  const rl = rateLimit(`keynote-register:${ip}`, 5, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 }
    )
  }

  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const firstName = String(body.firstName || '').trim().slice(0, 60)
  const lastName = String(body.lastName || '').trim().slice(0, 60)
  const country = String(body.country || '').trim().slice(0, 60)

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }
  if (isBlockedEmail(email)) {
    return NextResponse.json(
      { error: 'Veuillez utiliser une adresse email professionnelle valide.' },
      { status: 400 }
    )
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Prénom et nom requis' }, { status: 400 })
  }
  if (!country) {
    return NextResponse.json({ error: 'Pays requis' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Bloquer toute ré-inscription avec le même email
  const { data: existing } = await supabase
    .from('keynote_registrations')
    .select('id, promo_code')
    .eq('email', email)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json(
      {
        error:
          "Cette adresse email est déjà inscrite à la keynote. Vérifiez votre boîte mail (et vos spams) pour retrouver votre code promo.",
      },
      { status: 409 }
    )
  }

  let promoCode: string = generatePromoCode()
  const isNew = true

  // Générer un code unique (jusqu'à 5 essais)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await supabase
      .from('keynote_registrations')
      .select('id')
      .eq('promo_code', promoCode)
      .maybeSingle()
    if (!clash) break
    promoCode = generatePromoCode()
  }

  const ipForLog =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  const { error: insertErr } = await supabase.from('keynote_registrations').insert({
    email,
    first_name: firstName,
    last_name: lastName,
    country,
    promo_code: promoCode,
    ip: ipForLog,
    user_agent: userAgent,
    source: 'keynote-page',
  })

  if (insertErr) {
    // Doublon de course : email déjà pris entre les deux requêtes
    const code = (insertErr as { code?: string }).code
    if (code === '23505') {
      return NextResponse.json(
        {
          error:
            "Cette adresse email est déjà inscrite à la keynote.",
        },
        { status: 409 }
      )
    }
    console.error('keynote insert error:', insertErr)
    return NextResponse.json({ error: "Impossible d'enregistrer l'inscription" }, { status: 500 })
  }

  // Sync Mailchimp (best-effort, n'échoue pas l'inscription)
  let mailchimpStatus: 'subscribed' | 'error' | 'skipped' = 'skipped'
  let mailchimpError: string | null = null

  try {
    const settings = await getKeynoteSettings()
    const service = getMailchimpService()
    await service.loadConfig()

    const res = await service.upsertMember({
      email,
      audienceId: settings.audienceId || undefined,
      mergeFields: {
        FNAME: firstName,
        LNAME: lastName,
        COUNTRY: country,
        PROMO: promoCode,
      },
      tags: [settings.keynoteTag, settings.promoTag].filter(Boolean),
    })

    if (res.ok) {
      mailchimpStatus = 'subscribed'
    } else {
      mailchimpStatus = 'error'
      mailchimpError = res.error
    }
  } catch (err: any) {
    mailchimpStatus = 'error'
    mailchimpError = err?.message || 'Erreur Mailchimp'
  }

  // Mettre à jour les infos de sync (ne bloque pas la réponse)
  await supabase
    .from('keynote_registrations')
    .update({
      mailchimp_synced_at: new Date().toISOString(),
      mailchimp_status: mailchimpStatus,
      mailchimp_error: mailchimpError,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email)

  return NextResponse.json({
    ok: true,
    isNew,
    promoCode,
    mailchimp: {
      status: mailchimpStatus,
      error: mailchimpError,
    },
  })
}
