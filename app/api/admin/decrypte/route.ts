/**
 * GET /api/admin/decrypte
 *
 * Liste des inscriptions #BigFiveDecrypte avec stats agregees.
 * Filtres : ?q=<recherche email/nom/entreprise>  ?month=YYYY-MM
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  const supabase = getSupabaseAdmin()
  const url = new URL(request.url)
  const search = (url.searchParams.get('q') || '').trim().toLowerCase()
  const month = (url.searchParams.get('month') || '').trim()
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '500', 10) || 500,
    2000
  )

  let query = supabase
    .from('decrypte_registrations')
    .select(
      'id, user_id, email, full_name, phone, company, job_title, topics_of_interest, preferred_channel, plan_at_signup, session_month, consent_contact, mailchimp_status, mailchimp_synced_at, mailchimp_error, source, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (month) {
    query = query.eq('session_month', month)
  }
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,full_name.ilike.%${search}%,company.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) {
    const errCode = (error as { code?: string }).code
    const errMsg = (error as { message?: string }).message || ''
    if (
      errCode === '42P01' ||
      /relation .*decrypte_registrations.* does not exist/i.test(errMsg)
    ) {
      return NextResponse.json({
        registrations: [],
        returned: 0,
        months: [],
        stats: { total: 0, synced: 0, errors: 0, pending: 0 },
        warning: 'table_missing',
        message:
          "La table decrypte_registrations n'existe pas. Appliquez scripts/bigfive-decrypte-registrations.sql sur Supabase.",
      })
    }
    console.error('[admin/decrypte] list error:', error)
    return NextResponse.json({ error: errMsg || 'Erreur serveur' }, { status: 500 })
  }

  const { count: total } = await supabase
    .from('decrypte_registrations')
    .select('id', { count: 'exact', head: true })
  const { count: synced } = await supabase
    .from('decrypte_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('mailchimp_status', 'subscribed')
  const { count: errCount } = await supabase
    .from('decrypte_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('mailchimp_status', 'error')
  const { count: pending } = await supabase
    .from('decrypte_registrations')
    .select('id', { count: 'exact', head: true })
    .or('mailchimp_status.is.null,mailchimp_status.eq.skipped')

  // Liste distincte des sessions (pour le filtre)
  const { data: monthsRows } = await supabase
    .from('decrypte_registrations')
    .select('session_month')
    .order('session_month', { ascending: false })
    .limit(2000)
  const months = Array.from(
    new Set((monthsRows || []).map((r: { session_month: string }) => r.session_month))
  )

  return NextResponse.json({
    registrations: data || [],
    returned: data?.length || 0,
    months,
    stats: {
      total: total || 0,
      synced: synced || 0,
      errors: errCount || 0,
      pending: pending || 0,
    },
  })
}
