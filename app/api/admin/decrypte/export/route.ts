/**
 * GET /api/admin/decrypte/export
 * Export CSV des inscriptions #BigFiveDecrypte.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

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
  const month = (url.searchParams.get('month') || '').trim()

  let query = supabase
    .from('decrypte_registrations')
    .select(
      'email, full_name, phone, company, job_title, topics_of_interest, preferred_channel, plan_at_signup, session_month, consent_contact, mailchimp_status, mailchimp_synced_at, source, created_at'
    )
    .order('created_at', { ascending: false })
  if (month) query = query.eq('session_month', month)

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  const headers = [
    'email',
    'full_name',
    'phone',
    'company',
    'job_title',
    'topics_of_interest',
    'preferred_channel',
    'plan_at_signup',
    'session_month',
    'consent_contact',
    'mailchimp_status',
    'mailchimp_synced_at',
    'source',
    'created_at',
  ]
  const lines = [headers.join(',')]
  for (const r of (data || []) as Record<string, unknown>[]) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  }

  const csv = lines.join('\n')
  const suffix = month ? `-${month}` : ''
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="decrypte-registrations${suffix}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
