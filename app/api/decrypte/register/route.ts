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
  sessionId?: string
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

  // 4.b Resolution de la seance
  // Si l'admin a defini des seances : sessionId est requis et doit pointer
  // sur une seance 'open'. Sinon (table absente ou aucune seance), on retombe
  // sur le mode "session du mois" historique.
  const sessionIdRaw = String(body.sessionId || '').trim()
  const sessionId = sessionIdRaw && /^[0-9a-f-]{32,}$/i.test(sessionIdRaw) ? sessionIdRaw : null

  let resolvedSession: {
    id: string
    session_month: string
    status: string
    max_seats: number | null
  } | null = null

  if (sessionId) {
    const { data: sess, error: sessErr } = await admin
      .from('decrypte_sessions')
      .select('id, session_month, status, max_seats')
      .eq('id', sessionId)
      .maybeSingle<{ id: string; session_month: string; status: string; max_seats: number | null }>()

    if (sessErr) {
      const code = (sessErr as { code?: string }).code
      const msg = (sessErr as { message?: string }).message || ''
      if (code === '42P01' || /relation .*decrypte_sessions.* does not exist/i.test(msg)) {
        // Table sessions absente : on retombe sur le mode "session du mois"
        console.warn('[decrypte/register] decrypte_sessions absente, fallback session_month')
      } else {
        console.error('[decrypte/register] session lookup error', sessErr)
        return NextResponse.json({ error: 'Seance introuvable' }, { status: 400 })
      }
    } else if (!sess) {
      return NextResponse.json({ error: 'Seance introuvable' }, { status: 404 })
    } else if (sess.status !== 'open') {
      return NextResponse.json(
        { error: 'Cette seance n\'est plus ouverte aux inscriptions.' },
        { status: 409 }
      )
    } else {
      // Verifier la capacite
      if (sess.max_seats != null) {
        const { count } = await admin
          .from('decrypte_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sess.id)
        if ((count || 0) >= sess.max_seats) {
          return NextResponse.json(
            { error: 'Cette seance est complete.' },
            { status: 409 }
          )
        }
      }
      resolvedSession = sess
    }
  }

  const sessionMonth = resolvedSession?.session_month || currentSessionMonth()

  // 5. Empecher les doublons
  // - Si une seance est resolue : doublon par (user_id, session_id)
  // - Sinon (mode legacy) : doublon par (user_id, session_month)
  if (resolvedSession) {
    const { data: existingBySession } = await admin
      .from('decrypte_registrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_id', resolvedSession.id)
      .maybeSingle()
    if (existingBySession?.id) {
      return NextResponse.json(
        { error: 'Vous etes deja inscrit a cette seance.' },
        { status: 409 }
      )
    }
  } else {
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
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  // 6. Insert
  const insertPayload: Record<string, unknown> = {
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
  }
  if (resolvedSession?.id) {
    // Ne pas envoyer la cle si la migration sessions n'est pas encore appliquee
    insertPayload.session_id = resolvedSession.id
  }

  const { data: inserted, error: insertErr } = await (admin as any)
    .from('decrypte_registrations')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr) {
    const errCode = (insertErr as { code?: string }).code
    const errMsg = (insertErr as { message?: string }).message || ''

    if (errCode === '23505') {
      return NextResponse.json(
        { error: 'Vous etes deja inscrit a cette session.' },
        { status: 409 }
      )
    }

    // Table manquante (migration non appliquee) : message clair pour l'admin
    if (
      errCode === '42P01' ||
      /relation .*decrypte_registrations.* does not exist/i.test(errMsg) ||
      /could not find the table/i.test(errMsg)
    ) {
      console.error('[decrypte/register] table manquante :', insertErr)
      return NextResponse.json(
        {
          error:
            "La table d'inscription #BigFiveDecrypte n'est pas encore initialisee. Contactez l'equipe Big Five.",
          code: 'table_missing',
          hint: 'Appliquer scripts/bigfive-decrypte-registrations.sql sur Supabase',
        },
        { status: 500 }
      )
    }

    console.error('[decrypte/register] insert error:', {
      code: errCode,
      message: errMsg,
      details: (insertErr as { details?: string }).details,
      hint: (insertErr as { hint?: string }).hint,
    })
    return NextResponse.json(
      {
        error: "Impossible d'enregistrer l'inscription",
        code: errCode || 'unknown',
        details:
          process.env.NODE_ENV === 'production'
            ? undefined
            : errMsg || 'Erreur Supabase',
      },
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

  // On considere comme "deja inscrit" UNIQUEMENT une inscription liee a une
  // seance precise (session_id non NULL). Les inscriptions historiques
  // (sans session_id) ne bloquent pas l'utilisateur de choisir une nouvelle
  // seance.
  let registration: {
    id: string
    session_month: string
    created_at: string
    full_name: string
    email: string
    session_id?: string | null
  } | null = null

  // 1) Inscription liee a une seance (mode sessions)
  try {
    const { data: regWithSession, error: regSessErr } = await admin
      .from('decrypte_registrations')
      .select('id, session_month, created_at, full_name, email, session_id')
      .eq('user_id', user.id)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (regSessErr) {
      const errCode = (regSessErr as { code?: string }).code
      const errMsg = (regSessErr as { message?: string }).message || ''
      if (
        errCode === '42P01' ||
        /relation .*decrypte_registrations.* does not exist/i.test(errMsg)
      ) {
        console.error('[decrypte/register GET] table manquante')
        return NextResponse.json({
          canAccess: tier === 'pro',
          currentTier: tier,
          sessionMonth,
          registration: null,
          warning: 'table_missing',
        })
      }
      // Si la colonne session_id n'existe pas (migration sessions non appliquee),
      // on tombe en fallback ci-dessous.
      if (errCode !== '42703') {
        console.error('[decrypte/register GET] sess err:', regSessErr)
      }
    } else if (regWithSession) {
      registration = regWithSession as any
    }
  } catch (e) {
    // best effort
  }

  return NextResponse.json({
    canAccess: tier === 'pro',
    currentTier: tier,
    sessionMonth,
    registration,
  })
}
