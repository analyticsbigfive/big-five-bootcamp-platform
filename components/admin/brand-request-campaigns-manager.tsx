'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Search, Trash2, Megaphone, ExternalLink, Save, Check } from 'lucide-react'

interface Campaign {
  id: string
  title: string
  brand?: string | null
  country?: string | null
  category?: string | null
  platforms?: string[] | null
  status?: string | null
  imageUrl?: string | null
  slug?: string | null
}

interface Props {
  brandRequestId: string
  /** Pour pré-suggérer les campagnes pertinentes : marque, pays, secteurs. */
  brandName: string
  countries?: string[]
  sectors?: string[]
}

/**
 * Gestion manuelle des campagnes rattachées à une demande de suivi de marque.
 *
 * - Récupère les rattachements existants via GET /api/admin/brand-requests/[id]/campaigns
 * - Récupère le catalogue complet de campagnes via GET /api/admin/campaigns
 * - Permet d'ajouter / retirer des campagnes et de sauvegarder en un coup (PUT)
 * - Suggestion par défaut : campagnes dont le `brand` matche `brandName` (ilike)
 *
 * Remplace l'ancienne association automatique (brand + country + sector + platforms).
 */
export function BrandRequestCampaignsManager({ brandRequestId, brandName, countries = [], sectors = [] }: Props) {
  const [linked, setLinked] = useState<Campaign[]>([])
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [query, setQuery] = useState('')
  const [onlySameBrand, setOnlySameBrand] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // IDs sélectionnés (état local éditable avant sauvegarde)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [linkedRes, allRes] = await Promise.all([
          fetch(`/api/admin/brand-requests/${brandRequestId}/campaigns`),
          fetch('/api/admin/campaigns'),
        ])
        if (cancelled) return
        const linkedData = await linkedRes.json().catch(() => ({}))
        const allData = await allRes.json().catch(() => ({}))
        if (!linkedRes.ok) throw new Error(linkedData?.error || `Erreur ${linkedRes.status}`)
        if (!allRes.ok) throw new Error(allData?.error || `Erreur ${allRes.status}`)
        const linkedList: Campaign[] = linkedData.campaigns || []
        setLinked(linkedList)
        setAllCampaigns(allData.campaigns || [])
        setSelectedIds(new Set(linkedList.map((c) => c.id)))
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [brandRequestId])

  const normalizedBrand = brandName.trim().toLowerCase()

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCampaigns.filter((c) => {
      if (onlySameBrand && normalizedBrand) {
        if ((c.brand || '').trim().toLowerCase() !== normalizedBrand) return false
      }
      if (!q) return true
      const haystacks = [c.title, c.brand, c.country, c.category, ...(c.platforms || [])]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase())
      return haystacks.some((h) => h.includes(q))
    })
  }, [allCampaigns, onlySameBrand, normalizedBrand, query])

  const visibleCandidates = showAll ? candidates : candidates.slice(0, 30)

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSaved(false)
  }

  const selectedList = useMemo(() => {
    const byId = new Map(allCampaigns.map((c) => [c.id, c]))
    // garder aussi les campagnes déjà liées même si elles ne sont pas dans le catalogue retourné
    for (const c of linked) if (!byId.has(c.id)) byId.set(c.id, c)
    return Array.from(selectedIds).map((id) => byId.get(id)).filter(Boolean) as Campaign[]
  }, [selectedIds, allCampaigns, linked])

  const hasChanges = useMemo(() => {
    const original = new Set(linked.map((c) => c.id))
    if (original.size !== selectedIds.size) return true
    for (const id of selectedIds) if (!original.has(id)) return true
    return false
  }, [linked, selectedIds])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/brand-requests/${brandRequestId}/campaigns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignIds: Array.from(selectedIds) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
      // Resynchroniser l'état "linked" avec la nouvelle sélection
      const byId = new Map(allCampaigns.map((c) => [c.id, c]))
      for (const c of linked) if (!byId.has(c.id)) byId.set(c.id, c)
      setLinked(Array.from(selectedIds).map((id) => byId.get(id)).filter(Boolean) as Campaign[])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[#80368D]/20 bg-[#80368D]/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-[#80368D]" />
          <h4 className="text-sm font-bold text-[#80368D]">
            Campagnes rattachées à cette demande
          </h4>
          <span className="text-xs text-gray-500">
            {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            {hasChanges && <span className="ml-1 text-amber-700">· modifications non enregistrées</span>}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!hasChanges || saving}
          onClick={save}
          className="bg-[#80368D] hover:bg-[#80368D]/90 text-white"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : saved ? <Check className="h-3 w-3 mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </div>

      <p className="text-xs text-gray-600">
        L'utilisateur verra uniquement les campagnes que vous rattachez ici. Plus d'association
        automatique par marque / pays / secteurs / réseaux : vous gérez la sélection manuellement.
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[#80368D]" />
        </div>
      ) : (
        <>
          {/* Liste actuelle */}
          {selectedList.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Sélection actuelle
              </p>
              <ul className="space-y-1">
                {selectedList.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-gray-900 truncate flex-1" title={c.title}>
                      {c.title || '(sans titre)'}
                    </span>
                    {c.brand && <span className="text-gray-500 shrink-0">· {c.brand}</span>}
                    {c.country && <span className="text-gray-500 shrink-0">· {c.country}</span>}
                    {c.status && c.status !== 'Publié' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                        {c.status}
                      </span>
                    )}
                    {c.slug && (
                      <a
                        href={`/content/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#80368D] hover:underline shrink-0"
                        title="Ouvrir"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="rounded p-1 text-red-500 hover:bg-red-50 shrink-0"
                      title="Retirer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recherche / ajout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher une campagne (titre, marque, pays, secteur…)"
                  className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 py-1.5 text-xs outline-none focus:border-[#80368D]"
                />
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlySameBrand}
                  onChange={(e) => setOnlySameBrand(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Marque « {brandName} » uniquement
              </label>
            </div>

            {candidates.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Aucune campagne ne correspond.</p>
            ) : (
              <>
                <ul className="space-y-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {visibleCandidates.map((c) => {
                    const checked = selectedIds.has(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs border-b border-gray-100 last:border-b-0 transition-colors ${
                            checked ? 'bg-[#80368D]/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${
                              checked
                                ? 'border-[#80368D] bg-[#80368D] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="font-medium text-gray-900 truncate flex-1" title={c.title}>
                            {c.title || '(sans titre)'}
                          </span>
                          {c.brand && <span className="text-gray-500 shrink-0">{c.brand}</span>}
                          {c.country && <span className="text-gray-400 shrink-0">· {c.country}</span>}
                          {c.category && <span className="text-gray-400 shrink-0">· {c.category}</span>}
                          {c.status && c.status !== 'Publié' && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                              {c.status}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {!showAll && candidates.length > visibleCandidates.length && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="text-xs text-[#80368D] hover:underline"
                  >
                    + Afficher les {candidates.length - visibleCandidates.length} autres
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
