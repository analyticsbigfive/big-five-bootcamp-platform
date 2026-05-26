// Admin payments dashboard.
// Server Component. Read-only. No live PawaPay API call (balance derived
// from local `payments` and `payouts` tables). Aggregates via SQL RPC.

import { Wallet } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { BalanceCards, type PaymentTotals } from './balance-cards'
import { PaymentsTable, type PaymentRow, type PayoutRow } from './payments-table'
import { LiveBalances } from './live-balances'
import { LiveDeposits } from './live-deposits'
import { MonthFilter } from './month-filter'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const PAGE_SIZE = 50

// Paiements antérieurs à cette date = onboarding/sandbox, exclus du dashboard.
// Override via NEXT_PUBLIC_PAYMENTS_LIVE_SINCE (ISO 8601) si besoin.
const LIVE_SINCE =
  process.env.NEXT_PUBLIC_PAYMENTS_LIVE_SINCE || '2026-05-18T00:00:00Z'

type SearchParams = Promise<{ page?: string; month?: string }>

// Convert "YYYY-MM" into [startISO, endISO) bounds. Returns null bounds if
// the input is missing or malformed — caller falls back to LIVE_SINCE only.
function parseMonth(month: string | undefined, fallbackSince: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { since: fallbackSince, until: null as string | null, valid: false }
  }
  const [yStr, mStr] = month.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { since: fallbackSince, until: null, valid: false }
  }
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const end = new Date(Date.UTC(y, m, 1)).toISOString()
  // Respect global live cutoff: never go before it.
  const since = start < fallbackSince ? fallbackSince : start
  return { since, until: end, valid: true }
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { since, until, valid: monthValid } = parseMonth(sp.month, LIVE_SINCE)
  const selectedMonth = monthValid ? (sp.month as string) : ''

  const supabase = getSupabaseAdmin()

  let paymentsQuery = (supabase as any)
    .from('payments')
    .select(
      'id, ref_command, user_email, amount, final_amount, currency, status, payment_method, provider_transaction_id, client_phone, completed_at, created_at'
    )
    .gte('created_at', since)
  if (until) paymentsQuery = paymentsQuery.lt('created_at', until)
  paymentsQuery = paymentsQuery
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  let payoutsQuery = (supabase as any)
    .from('payouts')
    .select(
      'id, payout_id, amount, currency, status, provider, phone_number, country, provider_transaction_id, completed_at, created_at'
    )
    .gte('created_at', since)
  if (until) payoutsQuery = payoutsQuery.lt('created_at', until)
  payoutsQuery = payoutsQuery
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(0, 49)

  const totalsQuery = (supabase as any).rpc('admin_payment_totals', {
    live_since: since,
    live_until: until,
  })

  const [paymentsRes, payoutsRes, totalsRes] = await Promise.all([
    paymentsQuery,
    payoutsQuery,
    totalsQuery,
  ])

  if (paymentsRes.error) {
    console.error('[admin/payments] payments error', paymentsRes.error)
  }
  if (payoutsRes.error) {
    // `payouts` table may not exist yet — degrade gracefully.
    console.warn('[admin/payments] payouts error (table missing?)', payoutsRes.error)
  }
  if (totalsRes.error) {
    const err = totalsRes.error
    console.error('[admin/payments] totals RPC error', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    })
  }

  const allPayments: PaymentRow[] = paymentsRes.data || []
  const hasMore = allPayments.length > PAGE_SIZE
  const payments = hasMore ? allPayments.slice(0, PAGE_SIZE) : allPayments
  const payouts: PayoutRow[] = payoutsRes.data || []

  const totals: PaymentTotals = totalsRes.data?.[0] ||
    totalsRes.data || {
      total_collected: 0,
      total_paid_out: 0,
      available_balance: 0,
      payments_count: 0,
      payouts_count: 0,
      by_currency: {},
    }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Paiements
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Historique des paiements PawaPay et solde disponible (calculé localement,
            sans appel API externe). Onboarding/sandbox exclus — uniquement
            transactions depuis le{' '}
            {new Date(LIVE_SINCE).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            .
          </p>
        </div>
        <MonthFilter liveSince={LIVE_SINCE} selected={selectedMonth} />
      </div>

      <LiveBalances />

      <LiveDeposits />

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
          Vue interne (depuis la base, hors frais PawaPay)
          {selectedMonth && ` — ${selectedMonth}`}
        </p>
        <BalanceCards totals={totals} />
      </div>

      <PaymentsTable
        payments={payments}
        payouts={payouts}
        page={page}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        month={selectedMonth}
      />

      <p className="text-xs text-slate-400">
        Données mises en cache 60 secondes. Pour forcer un rafraîchissement, recharger
        la page après expiration.
      </p>
    </div>
  )
}
