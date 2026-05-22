'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function buildMonthOptions(liveSinceIso: string) {
  const start = new Date(liveSinceIso)
  const now = new Date()
  const options: { value: string; label: string }[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const value = `${y}-${String(m + 1).padStart(2, '0')}`
    options.push({ value, label: `${MONTH_NAMES[m]} ${y}` })
    cursor.setMonth(m + 1)
  }
  return options.reverse()
}

export function MonthFilter({
  liveSince,
  selected,
}: {
  liveSince: string
  selected: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const options = buildMonthOptions(liveSince)

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('month', value)
    else params.delete('month')
    params.delete('page')
    router.push(`/admin/payments?${params.toString()}`)
  }

  return (
    <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
      <Calendar className="w-4 h-4 text-slate-500" />
      <label htmlFor="month-filter" className="text-xs text-slate-500 font-medium">
        Mois :
      </label>
      <select
        id="month-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-medium bg-transparent focus:outline-none cursor-pointer"
      >
        <option value="">Tous</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
