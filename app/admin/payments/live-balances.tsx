'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Wallet, AlertCircle } from 'lucide-react'

type Balance = {
  country: string
  provider: string
  currency: string
  balance: string
}

type ApiResponse = {
  balances?: Balance[]
  cached?: boolean
  ageMs?: number
  error?: string
}

function fmtAmount(value: string, currency: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return `${value} ${currency}`
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toLocaleString('fr-FR')} ${currency}`
  }
}

export function LiveBalances() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pawapay/balances', { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`)
      } else {
        setData(json)
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const balances = data?.balances || []
  const totalByCurrency = balances.reduce<Record<string, number>>((acc, b) => {
    const n = Number(b.balance) || 0
    acc[b.currency] = (acc[b.currency] || 0) + n
    return acc
  }, {})

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Solde PawaPay (live)</h2>
            <p className="text-xs text-slate-500">
              Source officielle — API PawaPay /v2/wallet-balances.{' '}
              {data?.cached
                ? `Cache ${Math.round((data.ageMs || 0) / 1000)}s.`
                : 'Fraîchement chargé.'}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Erreur PawaPay : {error}</span>
        </div>
      )}

      {!error && loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {!error && data && (
        <>
          {Object.keys(totalByCurrency).length > 0 && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(totalByCurrency).map(([cur, total]) => (
                <div key={cur} className="rounded-xl bg-emerald-100 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                    Total {cur}
                  </p>
                  <p className="text-lg font-bold text-emerald-900">
                    {fmtAmount(String(total), cur)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {balances.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucun wallet retourné.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-xs">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Pays</th>
                    <th className="text-left px-2 py-1.5 font-medium">Provider</th>
                    <th className="text-right px-2 py-1.5 font-medium">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b, i) => (
                    <tr key={`${b.country}-${b.provider}-${i}`} className="border-t border-emerald-100">
                      <td className="px-2 py-1.5 text-slate-700">{b.country}</td>
                      <td className="px-2 py-1.5 text-slate-700">{b.provider}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-slate-900 whitespace-nowrap">
                        {fmtAmount(b.balance, b.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
