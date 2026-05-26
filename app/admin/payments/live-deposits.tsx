"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2, Radio, RotateCcw } from "lucide-react"

interface LocalDeposit {
  id: string
  ref_command: string
  amount: number
  final_amount?: number | null
  currency: string
  status: string
  payment_method: string | null
  client_phone: string | null
  user_email: string | null
  provider_transaction_id: string | null
  created_at: string
  completed_at: string | null
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusClass(s: string) {
  switch (s) {
    case "completed": return "bg-green-100 text-green-800"
    case "failed":
    case "rejected": return "bg-red-100 text-red-800"
    case "processing":
    case "enqueued":
    case "pending": return "bg-amber-100 text-amber-800"
    case "in_reconciliation": return "bg-blue-100 text-blue-800"
    case "canceled": return "bg-slate-100 text-slate-600"
    default: return "bg-slate-100 text-slate-700"
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    completed: "Payé",
    failed: "Échoué",
    rejected: "Rejeté",
    processing: "En cours",
    pending: "En attente",
    enqueued: "En file",
    in_reconciliation: "Réconciliation",
    canceled: "Annulé",
  }
  return map[s] || s
}

export function LiveDeposits() {
  const [deposits, setDeposits] = useState<LocalDeposit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<number>(7)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [resending, setResending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ days: String(days) })
      if (statusFilter) qs.set("status", statusFilter)
      const res = await fetch(`/api/admin/pawapay/deposits?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setDeposits(Array.isArray(data.deposits) ? data.deposits : [])
    } catch (e: any) {
      setError(e?.message || "Erreur chargement")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, days])

  useEffect(() => { void load() }, [load])

  const resend = async (ref: string) => {
    setResending(ref)
    try {
      const res = await fetch(`/api/admin/pawapay/resend-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositId: ref }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      await load()
    } catch (e: any) {
      alert("Erreur resend: " + e?.message)
    } finally {
      setResending(null)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold">Deposits PawaPay (table locale)</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {deposits.length} entrée{deposits.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Période"
            title="Période"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value={1}>24h</option>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <select
            aria-label="Statut"
            title="Statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">Tous statuts</option>
            <option value="completed">Payé</option>
            <option value="pending">En attente</option>
            <option value="processing">En cours</option>
            <option value="failed">Échoué</option>
            <option value="rejected">Rejeté</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">
          {error}
        </div>
      )}

      {deposits.length === 0 && !loading && !error ? (
        <p className="text-sm text-muted-foreground italic">Aucun deposit sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Référence</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Statut</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Montant</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Téléphone</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Créé</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Complété</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">
                    <span title={d.ref_command}>{d.ref_command.substring(0, 18)}…</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(d.status)}`}>
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {(d.final_amount ?? d.amount)?.toLocaleString("fr-FR")} {d.currency}
                  </td>
                  <td className="px-3 py-2 text-xs">{d.user_email || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.client_phone || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(d.created_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(d.completed_at)}</td>
                  <td className="px-3 py-2">
                    {(d.status === "pending" || d.status === "processing" || d.status === "enqueued") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        title="Renvoyer callback PawaPay"
                        disabled={resending === d.ref_command}
                        onClick={() => resend(d.ref_command)}
                      >
                        {resending === d.ref_command
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RotateCcw className="h-3 w-3" />
                        }
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
