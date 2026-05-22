import { Wallet, TrendingUp, TrendingDown, Receipt } from 'lucide-react'

type CurrencyEntry = {
  in: number
  out: number
  balance: number
  n_in: number
  n_out: number
}

export type PaymentTotals = {
  total_collected: number
  total_paid_out: number
  available_balance: number
  payments_count: number
  payouts_count: number
  by_currency: Record<string, CurrencyEntry>
}

function formatAmount(value: number, currency = 'XOF') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0)
  } catch {
    return `${Math.round(value || 0).toLocaleString('fr-FR')} ${currency}`
  }
}

export function BalanceCards({ totals }: { totals: PaymentTotals }) {
  const currencies = Object.keys(totals.by_currency || {})
  const primaryCurrency = currencies[0] || 'XOF'

  const cards = [
    {
      label: 'Solde disponible',
      value: formatAmount(totals.available_balance, primaryCurrency),
      hint: 'Encaissé − reversé',
      icon: Wallet,
      accent: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      label: 'Total encaissé',
      value: formatAmount(totals.total_collected, primaryCurrency),
      hint: `${totals.payments_count} paiement${totals.payments_count > 1 ? 's' : ''}`,
      icon: TrendingUp,
      accent: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'Total reversé',
      value: formatAmount(totals.total_paid_out, primaryCurrency),
      hint: `${totals.payouts_count} payout${totals.payouts_count > 1 ? 's' : ''}`,
      icon: TrendingDown,
      accent: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
    },
    {
      label: 'Transactions',
      value: String(totals.payments_count),
      hint: 'Paiements complétés',
      icon: Receipt,
      accent: 'from-slate-500 to-slate-600',
      bg: 'bg-slate-50',
      text: 'text-slate-700',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${c.accent} opacity-10`} />
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${c.bg} ${c.text} mb-3`}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 truncate">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      {currencies.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-3">
            Détail par devise
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currencies.map((cur) => {
              const e = totals.by_currency[cur]
              return (
                <div key={cur} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-700">{cur}</p>
                  <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                    <p>Encaissé : <span className="font-medium text-slate-900">{formatAmount(e.in, cur)}</span></p>
                    <p>Reversé : <span className="font-medium text-slate-900">{formatAmount(e.out, cur)}</span></p>
                    <p>Solde : <span className="font-bold text-emerald-700">{formatAmount(e.balance, cur)}</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
