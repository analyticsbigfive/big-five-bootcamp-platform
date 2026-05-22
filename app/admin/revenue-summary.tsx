'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, TrendingUp, TrendingDown, ArrowRight, RefreshCw, CircleDot } from 'lucide-react'

// Map currency → ISO country code (for flag emoji) + label.
// PawaPay returns ISO 4217 currency codes; we display a recognisable hint.
const CURRENCY_META: Record<string, { flag: string; label: string }> = {
  XOF: { flag: '🌍', label: 'UEMOA' },
  XAF: { flag: '🌍', label: 'CEMAC' },
  GHS: { flag: '🇬🇭', label: 'Ghana' },
  NGN: { flag: '🇳🇬', label: 'Nigeria' },
  KES: { flag: '🇰🇪', label: 'Kenya' },
  UGX: { flag: '🇺🇬', label: 'Ouganda' },
  TZS: { flag: '🇹🇿', label: 'Tanzanie' },
  RWF: { flag: '🇷🇼', label: 'Rwanda' },
  ZMW: { flag: '🇿🇲', label: 'Zambie' },
  CDF: { flag: '🇨🇩', label: 'RDC' },
  SLE: { flag: '🇸🇱', label: 'Sierra Leone' },
  SLL: { flag: '🇸🇱', label: 'Sierra Leone' },
  MWK: { flag: '🇲🇼', label: 'Malawi' },
  ZAR: { flag: '🇿🇦', label: 'Afrique du Sud' },
  USD: { flag: '🇺🇸', label: 'Dollar US' },
  EUR: { flag: '🇪🇺', label: 'Euro' },
}

type CurrencyEntry = {
  in: number
  out: number
  balance: number
  n_in: number
  n_out: number
}

type Totals = {
  total_collected: number
  total_paid_out: number
  available_balance: number
  payments_count: number
  payouts_count: number
  by_currency: Record<string, CurrencyEntry>
}

type WalletBalance = {
  country: string
  provider: string
  currency: string
  balance: string
}

type ApiResponse = {
  totals: Totals
  balances: WalletBalance[] | null
  live_since: string
  cached?: boolean
  ageMs?: number
  error?: string
}

function fmt(value: number, currency: string) {
  if (!Number.isFinite(value)) return `0 ${currency}`
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${Math.round(value).toLocaleString('fr-FR')} ${currency}`
  }
}

export function RevenueSummary() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payments/summary', { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      if (!res.ok) setError(json.error || `HTTP ${res.status}`)
      else setData(json)
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totals = data?.totals
  const currencies = totals ? Object.keys(totals.by_currency || {}) : []
  const primaryCurrency = currencies[0] || 'XOF'

  const liveByCurrency = (data?.balances || []).reduce<Record<string, number>>((acc, b) => {
    const n = Number(b.balance) || 0
    acc[b.currency] = (acc[b.currency] || 0) + n
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Revenus & solde PawaPay
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <Link
            href="/admin/payments"
            className="text-sm text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
          >
            Voir détail <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            Erreur chargement revenus : {error}
          </CardContent>
        </Card>
      )}

      {!error && loading && !data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 bg-white dark:bg-slate-800/50">
              <CardContent className="p-6">
                <div className="h-20 rounded bg-slate-100 dark:bg-slate-700 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!error && totals && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 bg-gradient-to-br from-emerald-50 to-white dark:bg-slate-800/50 overflow-hidden group hover:shadow-lg transition-all relative">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                        Solde disponible
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                        <CircleDot className="w-2.5 h-2.5 animate-pulse" />
                        {data?.balances ? 'Live PawaPay' : 'Local (encaissé − reversé)'}
                      </p>
                    </div>
                  </div>
                </div>

                {(() => {
                  const entries = Object.entries(liveByCurrency)
                  if (entries.length === 0) {
                    return (
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {fmt(totals.available_balance, primaryCurrency)}
                      </p>
                    )
                  }
                  const sorted = entries.sort(([, a], [, b]) => b - a)
                  const nonZero = sorted.filter(([, v]) => v > 0)
                  const zero = sorted.filter(([, v]) => v <= 0)
                  return (
                    <div className="space-y-1.5">
                      {nonZero.map(([cur, total]) => {
                        const meta = CURRENCY_META[cur] || { flag: '💱', label: cur }
                        return (
                          <div
                            key={cur}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-emerald-100/60 border border-emerald-200/60"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base leading-none">{meta.flag}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-emerald-900 leading-tight">
                                  {cur}
                                </p>
                                <p className="text-[10px] text-emerald-700/80 truncate">
                                  {meta.label}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-emerald-900 whitespace-nowrap">
                              {fmt(total, cur)}
                            </p>
                          </div>
                        )
                      })}
                      {zero.length > 0 && (
                        <details className="text-[10px] text-slate-400">
                          <summary className="cursor-pointer hover:text-slate-600 select-none px-2 py-1">
                            {zero.length} wallet{zero.length > 1 ? 's' : ''} à 0
                          </summary>
                          <div className="mt-1 flex flex-wrap gap-1 px-2">
                            {zero.map(([cur]) => {
                              const meta = CURRENCY_META[cur] || { flag: '·', label: cur }
                              return (
                                <span
                                  key={cur}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                                >
                                  <span>{meta.flag}</span>
                                  <span className="font-medium">{cur}</span>
                                </span>
                              )
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white dark:bg-slate-800/50 overflow-hidden group hover:shadow-lg transition-all relative">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {fmt(totals.total_collected, primaryCurrency)}
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                  Total encaissé
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totals.payments_count} paiement{totals.payments_count > 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white dark:bg-slate-800/50 overflow-hidden group hover:shadow-lg transition-all relative">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {fmt(totals.total_paid_out, primaryCurrency)}
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                  Total reversé
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totals.payouts_count} payout{totals.payouts_count > 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white dark:bg-slate-800/50 overflow-hidden group hover:shadow-lg transition-all relative">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {currencies.length || 1}
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                  Devises actives
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currencies.join(', ') || primaryCurrency}
                </p>
              </CardContent>
            </Card>
          </div>

          {data?.balances && data.balances.length > 0 && (
            <Card className="mt-4 border-0 bg-white dark:bg-slate-800/50">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-3">
                  Solde par wallet (live)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {data.balances.map((b, i) => (
                    <div key={`${b.country}-${b.provider}-${i}`} className="text-sm">
                      <p className="text-xs text-slate-500">
                        {b.country} · {b.provider}
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {fmt(Number(b.balance), b.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
