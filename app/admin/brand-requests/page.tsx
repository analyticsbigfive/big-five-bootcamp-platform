'use client'

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Building2, Loader2, ArrowLeft, MessageSquare, GitMerge, CheckSquare, Square, Trash2, Copy, Check, Upload, FileText, CreditCard, ShieldCheck, X, Search, Users } from "lucide-react"
import Link from "next/link"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { BrandRequestCampaignsManager } from "@/components/admin/brand-request-campaigns-manager"
import { sanitizeHtml } from "@/lib/sanitize-html"

interface BrandRequest {
  id: string
  user_id: string | null
  brand_name: string
  brand_url: string | null
  brand_urls: string[] | null
  social_networks: string[] | null
  brand_country: string | null
  brand_sector: string | null
  notes: string | null
  status: string
  admin_notes: string | null
  devis_amount: number | null
  devis_currency: string | null
  devis_url: string | null
  devis_sent_at: string | null
  devis_accepted_at: string | null
  paid_at: string | null
  payment_reference: string | null
  payment_method: string | null
  next_renewal_at: string | null
  auto_renew: boolean | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  user?: {
    id: string
    name: string
    email: string
    plan: string
  } | null
}

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
}

const STATUS_OPTIONS = [
  { value: 'pending',              label: 'En attente d’analyse', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'quote_in_preparation', label: 'Devis en préparation', color: 'bg-orange-100 text-orange-800' },
  { value: 'quote_sent',           label: 'Devis envoyé',         color: 'bg-indigo-100 text-indigo-800' },
  { value: 'quote_accepted',       label: 'En attente de paiement', color: 'bg-purple-100 text-purple-800' },
  { value: 'in_payment',           label: 'En attente de paiement', color: 'bg-amber-100 text-amber-800' },
  { value: 'in_production',        label: 'En cours de traitement', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed',            label: 'Disponible',           color: 'bg-green-100 text-green-800' },
  { value: 'rejected',             label: 'Refusée',              color: 'bg-red-100 text-red-800' },
  { value: 'cancelled',            label: 'Résiliée',             color: 'bg-gray-200 text-gray-700' },
  // Statuts legacy (compat ascendante)
  { value: 'accepted',             label: 'Acceptée (legacy)',    color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress',          label: 'En cours (legacy)',    color: 'bg-[#F5F5F5] text-[#0F0F0F]' },
]

export default function AdminBrandRequestsPage() {
  const [requests, setRequests] = useState<BrandRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [devisAmount, setDevisAmount] = useState<string>("")
  const [devisUrl, setDevisUrl] = useState<string>("")
  const [nextRenewalAt, setNextRenewalAt] = useState<string>("")
  const [paymentReference, setPaymentReference] = useState<string>("")
  const [saving, setSaving] = useState(false)

  // Upload PDF du devis
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Copier le lien de paiement
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Approbation manuelle (bouton "Approuver")
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Filtre + groupement par client
  const [searchQuery, setSearchQuery] = useState("")
  const [groupByClient, setGroupByClient] = useState(false)

  // Sélection pour fusion
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)

  // Suppression d'une demande
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/brand-requests')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const updateRequest = async (
    id: string,
    patch: {
      status?: string
      adminNotes?: string
      devisAmount?: number | null
      devisUrl?: string | null
      nextRenewalAt?: string | null
      paymentReference?: string | null
      forceApprove?: boolean
    } = {},
  ) => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { id }
      if (patch.status !== undefined) body.status = patch.status
      if (patch.adminNotes !== undefined) body.adminNotes = patch.adminNotes
      if (patch.devisAmount !== undefined) body.devisAmount = patch.devisAmount
      if (patch.devisUrl !== undefined) body.devisUrl = patch.devisUrl
      if (patch.nextRenewalAt !== undefined) body.nextRenewalAt = patch.nextRenewalAt
      if (patch.paymentReference !== undefined) body.paymentReference = patch.paymentReference
      if (patch.forceApprove !== undefined) body.forceApprove = patch.forceApprove

      const res = await fetch('/api/admin/brand-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setRequests(prev => prev.map(r => r.id === id ? { ...r, ...data.request } : r))
        setEditingId(null)
        setAdminNotes("")
        setDevisAmount("")
        setDevisUrl("")
        setNextRenewalAt("")
        setPaymentReference("")
      }
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const startEdit = (req: BrandRequest) => {
    setEditingId(req.id)
    setAdminNotes(req.admin_notes || "")
    setDevisAmount(req.devis_amount != null ? String(req.devis_amount) : "")
    setDevisUrl(req.devis_url || "")
    setNextRenewalAt(req.next_renewal_at ? req.next_renewal_at.slice(0, 10) : "")
    setPaymentReference(req.payment_reference || "")
    setUploadError(null)
  }

  // Upload PDF du devis vers /api/upload (bucket Supabase Storage)
  const handlePdfUpload = async (file: File) => {
    setUploadError(null)
    if (file.type !== 'application/pdf') {
      setUploadError('Seuls les fichiers PDF sont acceptés.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Le fichier dépasse 10 Mo.')
      return
    }
    setUploadingPdf(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok || !data.url) {
        setUploadError(data?.error || `Erreur ${res.status}`)
        return
      }
      setDevisUrl(data.url)
    } catch (e: any) {
      setUploadError(e?.message || 'Erreur réseau lors de l\'upload')
    } finally {
      setUploadingPdf(false)
    }
  }

  // Copier dans le presse-papier (lien de paiement, référence, etc.)
  const copyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* ignore */ }
  }

  // Bouton "Approuver" — approbation manuelle admin (override paid_at)
  const handleForceApprove = async (req: BrandRequest) => {
    const ok = window.confirm(
      `Approuver manuellement la demande « ${req.brand_name} » ?\n\n` +
      `Cette action force le statut « Disponible » et marque le paiement comme reçu ` +
      `(payment_method = "admin_override"). À utiliser uniquement si le paiement a été ` +
      `confirmé hors PawaPay.`
    )
    if (!ok) return
    setApprovingId(req.id)
    try {
      await updateRequest(req.id, { forceApprove: true })
    } finally {
      setApprovingId(null)
    }
  }

  // Construit le lien de paiement public (PawaPay) pour cette demande.
  const buildPaymentLink = (id: string) => {
    if (typeof window === 'undefined') return `/pay/brand-request/${id}`
    return `${window.location.origin}/pay/brand-request/${id}`
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setMergeError(null)
  }

  const handleDelete = async (req: BrandRequest) => {
    const label = req.brand_name || 'cette demande'
    const ok = window.confirm(
      `Supprimer définitivement la demande « ${label} » ?\n\n` +
      `Cette action est irréversible. Les notifications liées seront aussi supprimées. ` +
      `Les éventuels paiements restent conservés en base.`
    )
    if (!ok) return

    setDeletingId(req.id)
    try {
      const res = await fetch(`/api/admin/brand-requests?id=${encodeURIComponent(req.id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== req.id))
        setSelected(prev => {
          if (!prev.has(req.id)) return prev
          const next = new Set(prev)
          next.delete(req.id)
          return next
        })
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Erreur lors de la suppression.')
      }
    } catch {
      alert('Erreur réseau lors de la suppression.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleMerge = async () => {
    if (selected.size < 2) return
    setMerging(true)
    setMergeError(null)
    try {
      const res = await fetch('/api/admin/brand-requests/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMergeError(data.error || 'Erreur lors de la fusion.')
      } else {
        setSelected(new Set())
        await loadRequests()
      }
    } catch {
      setMergeError('Erreur réseau.')
    } finally {
      setMerging(false)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const inProgressCount = requests.filter(r => r.status === 'in_progress' || r.status === 'accepted').length

  // Filtre texte (insensible à la casse) sur marque / nom client / email / statut
  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return requests
    return requests.filter((r) => {
      const haystacks = [
        r.brand_name,
        r.user?.name,
        r.user?.email,
        r.status,
        STATUS_OPTIONS.find((s) => s.value === r.status)?.label,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase())
      return haystacks.some((h) => h.includes(q))
    })
  }, [requests, searchQuery])

  // Groupement par client. Ordre des fallbacks important : on s'appuie sur le
  // `user_id` brut (présent en colonne, FK → auth.users) AVANT de retomber sur
  // 'unknown'. Sinon, plusieurs utilisateurs distincts dont la ligne
  // public.users est manquante (join Supabase NULL) seraient écrasés ensemble
  // sous un même groupe "Client inconnu".
  const groupedRequests = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; sublabel: string; items: BrandRequest[] }
    >()
    for (const r of filteredRequests) {
      const key = r.user?.id || r.user?.email || r.user_id || 'unknown'
      const orphanLabel = r.user_id
        ? `Profil manquant (${r.user_id.slice(0, 8)}…)`
        : 'Client inconnu'
      const label = r.user?.name || r.user?.email || orphanLabel
      const sublabel = r.user?.email && r.user?.name
        ? r.user.email
        : (r.user?.plan || (r.user_id && !r.user ? `auth.uid: ${r.user_id}` : ''))
      let group = map.get(key)
      if (!group) {
        group = { key, label, sublabel, items: [] }
        map.set(key, group)
      }
      group.items.push(r)
    }
    // Tri alphabétique par label client, puis par date desc à l'intérieur
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        items: g.items.slice().sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredRequests])

  // Demandes sélectionnées — vérifier même marque / même user
  const selectedRequests = requests.filter(r => selected.has(r.id))
  const sameUser = selectedRequests.length > 1
    && new Set(selectedRequests.map(r => r.user?.id)).size === 1
  const sameBrand = selectedRequests.length > 1
    && new Set(selectedRequests.map(r => r.brand_name.toLowerCase().trim())).size === 1
  const canMerge = selected.size >= 2 && sameUser

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="rounded-lg p-2 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#a855f7]">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes de veille concurrentielle</h1>
          <p className="text-sm text-gray-500">
            {pendingCount} en attente · {inProgressCount} en cours · {requests.length} total
          </p>
        </div>
      </div>

      {/* Barre de recherche + groupement par client */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par marque, client, email ou statut…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 py-2 text-sm outline-none focus:border-[#F2B33D]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Effacer le filtre"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={groupByClient ? 'default' : 'outline'}
          onClick={() => setGroupByClient((v) => !v)}
          className={groupByClient ? 'bg-[#80368D] hover:bg-[#80368D]/90' : ''}
          title="Grouper les demandes par client"
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          {groupByClient ? 'Groupé par client' : 'Grouper par client'}
        </Button>
        <span className="text-xs text-gray-500 shrink-0">
          {filteredRequests.length} / {requests.length} demande{requests.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre de fusion */}
      {selected.size >= 2 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#80368D]/20 bg-[#80368D]/5 px-4 py-3">
          <GitMerge className="h-5 w-5 text-[#80368D] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#80368D]">
              {selected.size} demandes sélectionnées
            </p>
            {!sameUser && (
              <p className="text-xs text-red-500 mt-0.5">Les demandes doivent appartenir au même utilisateur.</p>
            )}
            {sameUser && !sameBrand && (
              <p className="text-xs text-amber-600 mt-0.5">Attention : les marques sélectionnées sont différentes.</p>
            )}
            {mergeError && <p className="text-xs text-red-500 mt-0.5">{mergeError}</p>}
          </div>
          <Button
            size="sm"
            disabled={!canMerge || merging}
            onClick={handleMerge}
            className="bg-[#80368D] hover:bg-[#80368D]/90 shrink-0"
          >
            {merging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitMerge className="h-3 w-3 mr-1" />}
            Fusionner
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSelected(new Set()); setMergeError(null) }}
            className="shrink-0"
          >
            Annuler
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#F2B33D]" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">
            {requests.length === 0 ? 'Aucune demande' : 'Aucun résultat'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {requests.length === 0
              ? 'Les demandes de veille concurrentielle apparaîtront ici.'
              : 'Aucune demande ne correspond à votre filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const renderRow = (req: BrandRequest) => {
            const currentStatus = STATUS_OPTIONS.find(s => s.value === req.status) || STATUS_OPTIONS[0]
            const isEditing = editingId === req.id
            const isSelected = selected.has(req.id)

            return (
              <div
                key={req.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
                  isSelected ? 'border-[#80368D]/40 ring-2 ring-[#80368D]/20' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox sélection */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(req.id)}
                    className="mt-0.5 shrink-0 text-gray-400 hover:text-[#80368D] transition-colors"
                    aria-label={isSelected ? "Désélectionner" : "Sélectionner pour fusion"}
                    title={isSelected ? "Désélectionner" : "Sélectionner pour fusion"}
                  >
                    {isSelected
                      ? <CheckSquare className="h-5 w-5 text-[#80368D]" />
                      : <Square className="h-5 w-5" />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">{req.brand_name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${currentStatus.color}`}>
                        {currentStatus.label}
                      </span>
                      {req.user ? (
                        <span className="text-xs text-gray-500">
                          par <strong>{req.user.name || req.user.email}</strong> ({req.user.plan})
                        </span>
                      ) : req.user_id ? (
                        <span
                          className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                          title="Aucune ligne dans public.users — exécutez scripts/diagnose-orphan-brand-requests.sql"
                        >
                          ⚠ Profil manquant · auth.uid: {req.user_id.slice(0, 8)}…
                        </span>
                      ) : (
                        <span className="text-xs text-red-700">⚠ user_id NULL</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                      {req.brand_country && <span>📍 {req.brand_country}</span>}
                      {req.brand_sector && <span>🏷️ {req.brand_sector}</span>}
                      <span>📅 {new Date(req.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>

                    {req.social_networks && req.social_networks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {req.social_networks.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center rounded-full bg-[#F2B33D]/10 px-2 py-0.5 text-[11px] font-medium text-[#F2B33D]"
                          >
                            {SOCIAL_LABELS[code] || code}
                          </span>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const urls = req.brand_urls?.length ? req.brand_urls : req.brand_url ? [req.brand_url] : []
                      if (!urls.length) return null
                      return (
                        <ul className="space-y-0.5 mb-2">
                          {urls.map((u, i) => (
                            <li key={i}>
                              <a
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#80368D] hover:underline break-all"
                              >
                                🔗 {u}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )
                    })()}

                    {req.notes && (
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-3">{req.notes}</p>
                    )}

                    {req.admin_notes && !isEditing && (
                      <div className="rounded-lg bg-[#F2B33D]/5 border border-[#F2B33D]/10 p-3 mb-3">
                        <p className="text-xs font-semibold text-[#F2B33D]/60 mb-1">Note admin :</p>
                        {/* admin_notes peut être du HTML (RichTextEditor Tiptap) ou du texte simple */}
                        <div
                          className="prose prose-sm max-w-none text-sm text-gray-700"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(req.admin_notes) }}
                        />
                      </div>
                    )}

                    {/* Badge statut paiement — visible en lecture seule */}
                    {!isEditing && (
                      <div className="mb-3">
                        {req.paid_at ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Paiement reçu le {new Date(req.paid_at).toLocaleDateString('fr-FR')}
                            {req.payment_method === 'admin_override' && (
                              <span className="ml-1 rounded bg-green-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                admin
                              </span>
                            )}
                          </span>
                        ) : req.status === 'in_payment' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Paiement en attente
                          </span>
                        ) : req.status === 'rejected' || req.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                            <X className="h-3.5 w-3.5" />
                            Paiement non approuvé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                            <CreditCard className="h-3.5 w-3.5" />
                            Paiement à recevoir
                          </span>
                        )}
                      </div>
                    )}

                    {!isEditing && (req.devis_amount || req.next_renewal_at) && (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-3 text-xs text-gray-700 space-y-0.5">
                        {req.devis_amount != null && (
                          <p>
                            <strong>Devis :</strong>{' '}
                            {new Intl.NumberFormat('fr-FR').format(req.devis_amount)} {req.devis_currency || 'XOF'}
                            {req.devis_url && (
                              <> · <a href={req.devis_url} target="_blank" rel="noopener noreferrer" className="text-[#80368D] hover:underline">📄 Voir le PDF</a></>
                            )}
                            {req.devis_accepted_at && <> · <span className="text-green-700">accepté</span></>}
                          </p>
                        )}
                        {req.payment_reference && (
                          <p>
                            <strong>Réf. paiement :</strong> {req.payment_reference}
                            {req.payment_method && <> · <span className="text-gray-500">{req.payment_method}</span></>}
                          </p>
                        )}
                        {req.next_renewal_at && (
                          <p>
                            <strong>Renouvellement :</strong> {new Date(req.next_renewal_at).toLocaleDateString('fr-FR')}
                            {req.auto_renew === false && <> · <span className="text-red-700">résilié</span></>}
                          </p>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-3 space-y-4 rounded-lg border border-[#F2B33D]/20 p-4 bg-[#F2B33D]/5">
                        {/* Note utilisateur — éditeur WYSIWYG (Tiptap) */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Note pour l'utilisateur
                          </label>
                          <RichTextEditor
                            content={adminNotes}
                            onChange={setAdminNotes}
                            placeholder="Note visible par l'utilisateur (mise en forme possible)..."
                            className="bg-white"
                          />
                        </div>

                        {/* Champs Devis */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`devis-amount-${req.id}`} className="block text-xs font-semibold text-gray-600 mb-1">
                              Montant du devis (XOF)
                            </label>
                            <input
                              id={`devis-amount-${req.id}`}
                              type="number"
                              min="0"
                              step="1000"
                              value={devisAmount}
                              onChange={(e) => setDevisAmount(e.target.value)}
                              placeholder="Ex : 250000"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#F2B33D]"
                            />
                          </div>

                          {/* Upload PDF du devis */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Devis (PDF)
                            </label>
                            <input
                              ref={pdfInputRef}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handlePdfUpload(f)
                                if (pdfInputRef.current) pdfInputRef.current.value = ''
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={uploadingPdf}
                                onClick={() => pdfInputRef.current?.click()}
                                className="bg-white"
                              >
                                {uploadingPdf
                                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  : <Upload className="h-3 w-3 mr-1" />}
                                {devisUrl ? 'Remplacer' : 'Uploader le PDF'}
                              </Button>
                              {devisUrl && (
                                <a
                                  href={devisUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[#80368D] hover:underline"
                                >
                                  <FileText className="h-3 w-3" />
                                  Voir le PDF
                                </a>
                              )}
                              {devisUrl && (
                                <button
                                  type="button"
                                  onClick={() => setDevisUrl('')}
                                  className="text-xs text-red-600 hover:underline"
                                  title="Retirer le PDF"
                                >
                                  Retirer
                                </button>
                              )}
                            </div>
                            {uploadError && (
                              <p className="mt-1 text-xs text-red-600">{uploadError}</p>
                            )}
                          </div>

                          <div>
                            <label htmlFor={`renewal-${req.id}`} className="block text-xs font-semibold text-gray-600 mb-1">
                              Prochain renouvellement
                            </label>
                            <input
                              id={`renewal-${req.id}`}
                              type="date"
                              value={nextRenewalAt}
                              onChange={(e) => setNextRenewalAt(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#F2B33D]"
                            />
                          </div>
                        </div>

                        {/* Lien de paiement PawaPay (auto-généré) — copier-coller pour envoi au client */}
                        {(() => {
                          const paymentLink = buildPaymentLink(req.id)
                          const linkKey = `pay-${req.id}`
                          return (
                            <div className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <CreditCard className="h-3.5 w-3.5 text-[#059669]" />
                                <p className="text-xs font-semibold text-[#059669]">
                                  Lien de paiement PawaPay
                                </p>
                                {!devisAmount && (
                                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                    ⚠ Définissez d'abord le montant
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  readOnly
                                  value={paymentLink}
                                  onFocus={(e) => e.currentTarget.select()}
                                  className="flex-1 min-w-0 rounded-lg border border-[#10B981]/20 bg-white px-3 py-2 text-xs font-mono text-gray-700 outline-none"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 bg-white"
                                  onClick={() => copyToClipboard(linkKey, paymentLink)}
                                  title="Copier le lien"
                                >
                                  {copiedKey === linkKey
                                    ? <Check className="h-3 w-3 mr-1 text-green-600" />
                                    : <Copy className="h-3 w-3 mr-1" />}
                                  {copiedKey === linkKey ? 'Copié' : 'Copier'}
                                </Button>
                                <a
                                  href={paymentLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Ouvrir le lien"
                                >
                                  <Button type="button" size="sm" variant="outline" className="shrink-0 bg-white">
                                    Ouvrir
                                  </Button>
                                </a>
                              </div>
                              <p className="mt-1.5 text-[11px] text-gray-600">
                                Envoyez ce lien au client. Une fois le paiement validé par PawaPay, la
                                demande passera automatiquement en « Disponible ».
                              </p>
                            </div>
                          )
                        })()}

                        {/* Référence de paiement — copiable / éditable pour suivi manuel */}
                        <div>
                          <label htmlFor={`payref-${req.id}`} className="block text-xs font-semibold text-gray-600 mb-1">
                            Référence de paiement
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`payref-${req.id}`}
                              type="text"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder="Renseignée automatiquement après paiement PawaPay"
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-[#F2B33D]"
                            />
                            {paymentReference && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="shrink-0 bg-white"
                                onClick={() => copyToClipboard(`ref-${req.id}`, paymentReference)}
                              >
                                {copiedKey === `ref-${req.id}`
                                  ? <Check className="h-3 w-3 mr-1 text-green-600" />
                                  : <Copy className="h-3 w-3 mr-1" />}
                                {copiedKey === `ref-${req.id}` ? 'Copié' : 'Copier'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Gestion manuelle des campagnes rattachées à cette demande
                            (remplace l'association automatique par marque / pays / secteurs). */}
                        <BrandRequestCampaignsManager
                          brandRequestId={req.id}
                          brandName={req.brand_name}
                          countries={req.brand_country ? [req.brand_country] : []}
                          sectors={req.brand_sector ? [req.brand_sector] : []}
                        />

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" disabled={saving} className="bg-[#F2B33D] hover:bg-[#F2B33D]/90"
                            onClick={() => updateRequest(req.id, {
                              adminNotes,
                              devisAmount: devisAmount === '' ? null : Number(devisAmount),
                              devisUrl: devisUrl || null,
                              nextRenewalAt: nextRenewalAt ? new Date(nextRenewalAt).toISOString() : null,
                              paymentReference: paymentReference || null,
                            })}>
                            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Enregistrer
                          </Button>
                          {req.status === 'pending' && devisAmount && (
                            <Button size="sm" variant="outline" disabled={saving}
                              onClick={() => updateRequest(req.id, {
                                status: 'quote_sent',
                                adminNotes,
                                devisAmount: Number(devisAmount),
                                devisUrl: devisUrl || null,
                              })}>
                              Enregistrer & envoyer le devis
                            </Button>
                          )}
                          <Button size="sm" variant="outline"
                            onClick={() => { setEditingId(null); setAdminNotes(""); setDevisAmount(""); setDevisUrl(""); setNextRenewalAt(""); setPaymentReference(""); setUploadError(null) }}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <select
                      value={req.status}
                      onChange={(e) => updateRequest(req.id, { status: e.target.value })}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium outline-none focus:border-[#F2B33D]"
                      aria-label="Changer le statut"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Bouton "Approuver" — approbation manuelle (override paid_at).
                        Caché si déjà payée ou si la demande est dans un état terminal. */}
                    {!req.paid_at && req.status !== 'rejected' && req.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        disabled={approvingId === req.id || saving}
                        onClick={() => handleForceApprove(req)}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white"
                        title="Marquer comme payée et disponible (override paid_at)"
                      >
                        {approvingId === req.id
                          ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          : <ShieldCheck className="h-3 w-3 mr-1" />}
                        Approuver
                      </Button>
                    )}

                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => startEdit(req)}>
                      <MessageSquare className="h-3 w-3 mr-1" />Répondre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deletingId === req.id}
                      onClick={() => handleDelete(req)}
                      title="Supprimer définitivement cette demande"
                    >
                      {deletingId === req.id
                        ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        : <Trash2 className="h-3 w-3 mr-1" />}
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            )
            }

            if (groupByClient) {
              return groupedRequests.map((g) => (
                <section key={g.key}>
                  <header className="mb-2 flex items-center gap-2 px-1">
                    <Users className="h-4 w-4 text-[#80368D]" />
                    <h2 className="text-sm font-bold text-[#80368D]">{g.label}</h2>
                    {g.sublabel && (
                      <span className="text-xs text-gray-500">· {g.sublabel}</span>
                    )}
                    <span className="ml-auto text-xs text-gray-500">
                      {g.items.length} demande{g.items.length > 1 ? 's' : ''}
                    </span>
                  </header>
                  <div className="space-y-4">{g.items.map(renderRow)}</div>
                </section>
              ))
            }
            return <div className="space-y-4">{filteredRequests.map(renderRow)}</div>
          })()}
        </div>
      )}
    </div>
  )
}
