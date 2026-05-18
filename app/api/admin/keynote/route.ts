import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET — Liste des inscrits + codes promo
export async function GET(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const url = new URL(request.url)
  const search = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10) || 500, 2000)

  let query = supabase
    .from('keynote_registrations')
    .select('id, email, first_name, last_name, country, promo_code, mailchimp_status, mailchimp_synced_at, mailchimp_error, promo_redeemed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search) {
    const { escapeForIlike } = await import('@/lib/search-utils')
    const s = escapeForIlike(search)
    if (s) {
      query = query.or(
        `email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,promo_code.ilike.%${s}%`
      )
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('keynote list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Stats agrégées
  const { count: total } = await supabase
    .from('keynote_registrations')
    .select('id', { count: 'exact', head: true })
  const { count: synced } = await supabase
    .from('keynote_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('mailchimp_status', 'subscribed')
  const { count: redeemed } = await supabase
    .from('keynote_registrations')
    .select('id', { count: 'exact', head: true })
    .not('promo_redeemed_at', 'is', null)

  return NextResponse.json({
    registrations: data || [],
    returned: data?.length || 0,
    stats: {
      total: total || 0,
      synced: synced || 0,
      redeemed: redeemed || 0,
    },
  })
}
