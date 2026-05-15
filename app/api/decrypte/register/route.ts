/**
 * API Route: POST /api/decrypte/register
 *
 * #BigFiveDecrypte — Pro-only signup endpoint.
 * Collects contact details for a monthly expert debrief session.
 * The session itself is hosted externally (Zoom/Meet/Mailchimp).
 * This endpoint only stores contact info for the Big Five team
 * to reach out manually.
 *
 * Access: Pro plan only. Free/Decouverte/Basic are rejected with 403.
 *
 * GET retourne l'inscription existante de l'utilisateur courant pour
 * la session du mois en cours (ou null).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { getMailchimpService } from '@/lib/mailchimp'
import { resolveTier } from '@/lib/quotas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Payload {
  fullName?: string
  phone?: string
  company?: string
  jobTitle?: string
  topicsOfInterest?: string
  preferredChannel?: string
  consentContact?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function currentSessionMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

async function getDecrypteSettings() {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'mailchimp_decrypte_audience_id',
      'mailchimp_decrypte_tag',
    ])
  const map: Record<string, string> = {}
  data?.forEach((row: { key: string; value: string }) => {
    map[row.key] = row.value
  })
  return {
    audienceId: map['mailchimp_decrypte_audience_id'] || '',
    decrypteTag: map['mailchimp_decrypte_tag'] || 'bigfive-decrypte',
  }
}

export async function POST(request: NextRequest) {
  // 1. Auth — utilisateur connecte requis
  const supabaseServer = await getSupabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // 2. Charger le profil pour verifier le plan
  const admin = getSupabaseAdmin()
  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('id, email, name, plan, subscription_status, subscription_end_date')
    .eq('id', user.id)
    .single<{
      id: string
      email: string | null
      name: string | null
      plan: string | null
      subscription_status: string | null
      subscription_end_date: string | null
    }>()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  // 3. Gate Pro strict — pas de fallback. Decouverte/Basic/Free sont bloques.
  const tier = resolveTier(profile.plan, profile.subscription_status)
  if (tier !== 'pro') {
    return NextResponse.json(
      {
        error: 'Plan Pro requis',
        message:
          '#BigFiveDecrypte est reserve aux abonnes Pro. Passez en Pro pour acceder a la session.',
        currentPlan: profile.plan || 'Non abonné',
      },
      { status: 403 }
    )
  }

  // 4. Parse body
  let body: Payload
  try {
    body = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const email = String(profile.email || user.email || '').trim().toLowerCase()
  const fullName = String(body.fullName || profile.name || '').trim().slice(0, 120)
  const phone = String(body.phone || '').trim().slice(0, 30) || null
  const company = String(body.company || '').trim().slice(0, 120) || null
  const jobTitle = String(body.jobTitle || '').trim().slice(0, 120) || null
  const topicsOfInterest = String(body.topicsOfInterest || '').trim().slice(0, 1000) || null
  const preferredChannel = String(body.preferredChannel || '').trim().slice(0, 60) || null
  const consentContact = !!body.consentContact

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }
  if (!fullName) {
    return NextResponse.json({ error: 'Nom complet requis' }, { status: 400 })
  }
  if (!consentContact) {
    return NextResponse.json(
      { error: 'Consentement requis pour etre contacte par l\'equipe Big Five' },
      { status: 400 }
    )
  }

  const sessionMonth = currentSessionMonth()

  // 5. Empecher les doublons pour la session du mois en cours
  const { data: existing } = await admin
    .from('decrypte_registrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_month', sessionMonth)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json(
      {
        error:
          'Vous etes deja inscrit a la session #BigFiveDecrypte de ce mois. L\'equipe Big Five vous contactera bientot.',
      },
      { status: 409 }
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  // 6. Insert
  const { data: inserted, error: insertErr } = await (admin as any)
    .from('decrypte_registrations')
    .insert({
      user_id: user.id,
      email,
      full_name: fullName,
      phone,
      company,
      job_title: jobTitle,
      topics_of_interest: topicsOfInterest,
      preferred_channel: preferredChannel,
      plan_at_signup: profile.plan || 'Pro',
      session_month: sessionMonth,
      consent_contact: consentContact,
      source: 'decrypte-page',
      ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'Vous etes deja inscrit a cette session.' },
        { status: 409 }
      )
    }
    console.error('decrypte insert error:', insertErr)
    return NextResponse.json(
      { error: 'Impossible d\'enregistrer l\'inscription' },
      { status: 500 }
    )
  }

  // 7. Sync Mailchimp (best-effort)
  let mailchimpStatus: 'subscribed' | 'error' | 'skipped' = 'skipped'
  let mailchimpError: string | null = null

  try {
    const settings = await getDecrypteSettings()
    const service = getMailchimpService()
    await service.loadConfig()

    const [firstName, ...rest] = fullName.split(/\s+/)
    const lastName = rest.join(' ')

    const res = await service.upsertMember({
      email,
      audienceId: settings.audienceId || undefined,
      mergeFields: {
        FNAME: firstName || fullName,
        LNAME: lastName,
        COMPANY: company || '',
        JOBTITLE: jobTitle || '',
        TOPICS: topicsOfInterest || '',
        PHONE: phone || '',
        SESSION: sessionMonth,
      },
      tags: [settings.decrypteTag, `decrypte-${sessionMonth}`].filter(Boolean),
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

  await (admin as any)
    .from('decrypte_registrations')
    .update({
      mailchimp_synced_at: new Date().toISOString(),
      mailchimp_status: mailchimpStatus,
      mailchimp_error: mailchimpError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', (inserted as any).id)

  return NextResponse.json({
    ok: true,
    id: (inserted as any).id,
    sessionMonth,
    mailchimp: {
      status: mailchimpStatus,
      error: mailchimpError,
    },
  })
}

export async function GET(_request: NextRequest) {
  const supabaseServer = await getSupabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('users')
    .select('plan, subscription_status')
    .eq('id', user.id)
    .single<{ plan: string | null; subscription_status: string | null }>()

  const tier = resolveTier(profile?.plan, profile?.subscription_status)
  const sessionMonth = currentSessionMonth()

  const { data: registration } = await admin
    .from('decrypte_registrations')
    .select('id, session_month, created_at, full_name, email')
    .eq('user_id', user.id)
    .eq('session_month', sessionMonth)
    .maybeSingle()

  return NextResponse.json({
    canAccess: tier === 'pro',
    currentTier: tier,
    sessionMonth,
    registration: registration || null,
  })
}
