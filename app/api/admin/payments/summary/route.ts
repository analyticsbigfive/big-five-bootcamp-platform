import { NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { getWalletBalances } from '@/lib/pawapay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIVE_SINCE =
  process.env.NEXT_PUBLIC_PAYMENTS_LIVE_SINCE || '2026-05-18T00:00:00Z'

// Shared in-memory cache. 60s TTL covers most admin reloads without
// hammering PawaPay or Supabase.
let cache: { at: number; data: any } | null = null
const TTL_MS = 60_000

export async function GET() {
  const user = await checkAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ cached: true, ageMs: now - cache.at, ...cache.data })
  }

  const supabase = getSupabaseAdmin()

  const totalsPromise = (supabase as any).rpc('admin_payment_totals', {
    live_since: LIVE_SINCE,
    live_until: null,
  })

  // PawaPay call wrapped — if it fails (token, network), we still return totals.
  const balancesPromise = getWalletBalances().catch((e: any) => {
    console.warn('[admin/payments/summary] wallet balances failed', e?.message)
    return null
  })

  const [totalsRes, balancesRes] = await Promise.all([totalsPromise, balancesPromise])

  if (totalsRes.error) {
    console.error('[admin/payments/summary] totals RPC error', {
      message: totalsRes.error.message,
      code: totalsRes.error.code,
    })
  }

  const totalsRow =
    (Array.isArray(totalsRes.data) ? totalsRes.data[0] : totalsRes.data) || {
      total_collected: 0,
      total_paid_out: 0,
      available_balance: 0,
      payments_count: 0,
      payouts_count: 0,
      by_currency: {},
    }

  const data = {
    totals: totalsRow,
    balances: balancesRes?.balances || null,
    live_since: LIVE_SINCE,
  }

  cache = { at: now, data }
  return NextResponse.json({ cached: false, ageMs: 0, ...data })
}
