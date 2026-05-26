import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await checkAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const days = Math.min(365, Math.max(1, Number(sp.get('days') || 7)))
  const status = sp.get('status') || undefined

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = getSupabaseAdmin()
  let query = (supabase as any)
    .from('payments')
    .select(
      'id, ref_command, amount, final_amount, currency, status, payment_method, client_phone, user_email, provider_transaction_id, created_at, completed_at'
    )
    .like('payment_method', 'pawapay%')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deposits: data || [] })
}
