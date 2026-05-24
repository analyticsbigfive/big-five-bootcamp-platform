'use client'

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFavorites } from "@/hooks/use-favorites"
import { Button } from "@/components/ui/button"
import { Heart, Loader2, LogIn, Trash2, BookmarkCheck, ArrowLeft, FolderOpen, FolderPlus, X, Lock, Pencil, FolderInput, Share2, Globe, Link2, Check, XCircle, Sparkles, MoreHorizontal, Grid3X3, ChevronLeft, Search, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import Image from "next/image"
import { cn, getGoogleDriveImageUrl } from "@/lib/utils"
import { isPaidPlan } from "@/lib/pricing"
import { CollectionModal } from "@/components/collections/collection-modal"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthContext } from "@/components/auth-provider"
import { useRequireActiveSubscription } from "@/hooks/use-require-active-subscription"
import { createClient } from "@/lib/supabase"
import { getCampaignsByIds } from "@/app/actions/creative"

interface Collection {
  id: string
  name: string
  created_at: string
  item_count: number
  campaign_ids: string[]
  share_token?: string | null
  is_shared?: boolean
}

// ─── Mosaïque de couverture style Instagram ───────────────────────────
// 1 grande image à gauche + 2 petites empilées à droite (ou grille 2×2 si 4+)
function CollectionCover({ thumbnails, name }: { thumbnails: string[]; name: string }) {
  const t = thumbnails.map(getGoogleDriveImageUrl)

  if (t.length === 0) {
    return (
      <div className="aspect-square w-full rounded-sm bg-gradient-to-br from-[#F5F5F5]/60 to-[#F2B33D]/10 flex items-center justify-center">
        <FolderOpen className="h-10 w-10 text-[#F2B33D]/25" />
      </div>
    )
  }

  if (t.length === 1) {
    return (
      <div className="aspect-square w-full rounded-sm overflow-hidden relative">
        <Image src={t[0]} alt={name} fill className="object-cover" />
      </div>
    )
  }

  if (t.length === 2) {
    return (
      <div className="aspect-square w-full rounded-sm overflow-hidden grid grid-cols-2 gap-[2px]">
        {t.map((src, i) => (
          <div key={i} className="relative overflow-hidden">
            <Image src={src} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
    )
  }

  // 3+ images : 1 grande à gauche, 2 petites à droite (style Instagram)
  return (
    <div className="aspect-square w-full rounded-sm overflow-hidden grid grid-cols-2 gap-[2px]">
      <div className="relative row-span-2 overflow-hidden">
        <Image src={t[0]} alt={name} fill className="object-cover" />
      </div>
      <div className="relative overflow-hidden">
        <Image src={t[1]} alt="" fill className="object-cover" />
      </div>
      <div className="relative overflow-hidden">
        {t[2] ? (
          <Image src={t[2]} alt="" fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-[#F5F5F5]/40" />
        )}
      </div>
    </div>
  )
}


function FavoritesPageContent() {
  // Force le choix d'un plan : redirige vers /subscribe?required=1
  // si l'utilisateur n'a pas d'abonnement actif.
  const { checking: subChecking, locked: subLocked } = useRequireActiveSubscription()

  const {
    favoritesWithCampaigns,
    fetchFavoritesWithCampaigns,
    removeFavorite,
    loading,
    isAuthenticated,
    error
  } = useFavorites()
  const { userPlan: contextPlan } = useAuthContext()
  const [mounted, setMounted] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  const [sharingCollectionId, setSharingCollectionId] = useState<string | null>(null)
  const [shareModalCollection, setShareModalCollection] = useState<Collection | null>(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<{ id: string; name: string } | null>(null)
  const [collectionCampaigns, setCollectionCampaigns] = useState<any[]>([])
  const [loadingCollectionCampaigns, setLoadingCollectionCampaigns] = useState(false)
  const [collectionThumbnails, setCollectionThumbnails] = useState<Record<string, string[]>>({})
  const supabase = createClient()

  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') === 'collections' ? 'collections' : 'favorites'
  const [campaignSearch, setCampaignSearch] = useState("")
  const [campaignSort, setCampaignSort] = useState<"recent" | "title">("recent")

  const isPaid = isPaidPlan(contextPlan)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && isAuthenticated) {
      fetchFavoritesWithCampaigns()
      loadCollections()
    }
  }, [mounted, isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCollections = async () => {
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const data = await res.json()
        const cols = data.collections || []
        setCollections(cols)
        const allCampaignIds = [...new Set(cols.flatMap((c: Collection) => c.campaign_ids || []))]
        if (allCampaignIds.length > 0) {
          const { data: thumbData } = await supabase
            .from('campaigns')
            .select('id, thumbnail')
            .in('id', allCampaignIds)
          if (thumbData) {
            const thumbMap: Record<string, string> = {}
            thumbData.forEach((t: any) => { if (t.thumbnail) thumbMap[t.id] = t.thumbnail })
            const result: Record<string, string[]> = {}
            cols.forEach((col: Collection) => {
              result[col.id] = (col.campaign_ids || [])
                .map((id: string) => thumbMap[id])
                .filter(Boolean)
                .slice(0, 4)
            })
            setCollectionThumbnails(result)
          }
        }
      }
    } catch { /* Table pas encore créée */ }
  }

  const loadCollectionCampaigns = async (campaignIds: string[]) => {
    if (campaignIds.length === 0) {
      setCollectionCampaigns([])
      return
    }
    setLoadingCollectionCampaigns(true)
    try {
      // Server action (service_role + filtrage premium) : ne renvoie jamais
      // analyse/how_to_use à un compte non-premium.
      const { success, data } = await getCampaignsByIds(campaignIds)
      if (success && data) {
        setCollectionCampaigns(data)
      } else {
        setCollectionCampaigns([])
      }
    } catch { setCollectionCampaigns([]) }
    finally { setLoadingCollectionCampaigns(false) }
  }

  useEffect(() => {
    if (activeCollection) {
      const col = collections.find(c => c.id === activeCollection)
      if (col) {
        loadCollectionCampaigns(col.campaign_ids)
      }
    } else {
      setCollectionCampaigns([])
    }
  }, [activeCollection]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCollectionModalSave = async (data: { name: string; description: string }) => {
    if (editingCollection) {
      // Mode édition
      const res = await fetch('/api/collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCollection.id, name: data.name }),
      })
      if (res.ok) {
        setCollections(prev => prev.map(c => c.id === editingCollection.id ? { ...c, name: data.name } : c))
        toast.success("Collection renommée")
      } else {
        throw new Error("Impossible de renommer")
      }
    } else {
      // Mode création
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, description: data.description }),
      })
      if (res.ok) {
        const result = await res.json()
        setCollections(prev => [...prev, result.collection])
        toast.success(`Collection « ${result.collection.name} » créée`)
      } else {
        throw new Error("Impossible de créer la collection")
      }
    }
  }

  const deleteCollection = async (id: string) => {
    if (!confirm('Supprimer cette collection ? Les favoris ne seront pas supprimés.')) return
    const name = collections.find(c => c.id === id)?.name
    try {
      const res = await fetch(`/api/collections?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCollections(prev => prev.filter(c => c.id !== id))
        if (activeCollection === id) setActiveCollection(null)
        toast.success(`Collection « ${name} » supprimée`)
      } else {
        toast.error("Impossible de supprimer la collection")
      }
    } catch { toast.error("Erreur lors de la suppression") }
  }

  const addToCollection = async (collectionId: string, campaignId: string) => {
    const colName = collections.find(c => c.id === collectionId)?.name
    try {
      const res = await fetch('/api/collections/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, campaignId }),
      })
      if (res.ok) {
        setCollections(prev => prev.map(c => {
          if (c.id === collectionId) {
            return {
              ...c,
              item_count: c.item_count + 1,
              campaign_ids: [...c.campaign_ids, campaignId],
            }
          }
          return c
        }))
        toast.success(`Ajouté à la collection « ${colName} »`)
      } else if (res.status === 409) {
        toast.info(`Déjà dans « ${colName} »`)
      } else {
        toast.error("Impossible d'ajouter à la collection")
      }
    } catch { toast.error("Erreur lors de l'ajout") }
  }

  const removeFromCollection = async (collectionId: string, campaignId: string) => {
    const colName = collections.find(c => c.id === collectionId)?.name
    try {
      const res = await fetch(`/api/collections/items?collectionId=${collectionId}&campaignId=${campaignId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setCollections(prev => prev.map(c => {
          if (c.id === collectionId) {
            return {
              ...c,
              item_count: Math.max(0, c.item_count - 1),
              campaign_ids: c.campaign_ids.filter(id => id !== campaignId),
            }
          }
          return c
        }))
        setCollectionCampaigns(prev => prev.filter(c => c.id !== campaignId))
        toast.success(`Retiré de la collection « ${colName} »`)
      }
    } catch { /* ignore */ }
  }

  const openShareModal = async (col: Collection) => {
    if (col.is_shared && col.share_token) {
      setShareModalCollection(col)
      return
    }
    setSharingCollectionId(col.id)
    try {
      const res = await fetch('/api/collections/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: col.id }),
      })
      if (res.ok) {
        const data = await res.json()
        const updated = { ...col, share_token: data.share_token, is_shared: true }
        setCollections(prev => prev.map(c => c.id === col.id ? updated : c))
        setShareModalCollection(updated)
      } else {
        toast.error("Impossible d'activer le partage")
      }
    } catch { toast.error("Erreur réseau") } finally { setSharingCollectionId(null) }
  }

  const revokeShare = async (collectionId: string) => {
    try {
      const res = await fetch(`/api/collections/share?id=${collectionId}`, { method: 'DELETE' })
      if (res.ok) {
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? { ...c, share_token: null, is_shared: false } : c
        ))
        toast.success("Partage révoqué")
      }
    } catch { /* ignore */ }
  }

  const handleRemove = async (campaignId: string) => {
    setRemovingId(campaignId)
    await removeFavorite(campaignId)
    setRemovingId(null)
  }

  const campaigns = mounted && isAuthenticated && !loading && !error
    ? favoritesWithCampaigns.filter(f => f.campaign)
    : []

  const filteredCampaigns = activeCollection
    ? collectionCampaigns.map(c => ({
        id: c.id,
        campaign_id: c.id,
        campaign: c,
      }))
    : campaigns

  // ─── Rendu : état vide / chargement / non-authentifié ─────────────

  const renderFavoritesContent = () => {
    if (!mounted || (isAuthenticated && loading) || (activeCollection && loadingCollectionCampaigns)) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#F2B33D] mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#F5F5F5] bg-gradient-to-br from-[#f8fafc] to-[#f0f4ff] p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F2B33D]/10">
            <LogIn className="h-10 w-10 text-[#F2B33D]" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-[#0F0F0F]">Connexion requise</h3>
          <p className="mt-2 text-muted-foreground max-w-md">
            Connectez-vous pour accéder à vos favoris et retrouver vos campagnes sauvegardées.
          </p>
          <div className="mt-6 flex gap-4">
            <Link href="/login?redirect=/favorites">
              <Button className="bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]">
                <LogIn className="h-4 w-4 mr-2" />Se connecter
              </Button>
            </Link>
            <Link href="/register?redirect=/favorites">
              <Button variant="outline">Créer un compte</Button>
            </Link>
          </div>
        </div>
      )
    }

    // Favoris verrouillés pour le plan Découverte — teaser concret + aperçu d'usage
    if (!isPaid) {
      const sampleCollections = [
        { name: "Pitch client BNI Bank", emoji: "💼", count: 7, hue: "from-amber-100 to-orange-100", ring: "ring-amber-200" },
        { name: "Inspiration packshots", emoji: "📦", count: 12, hue: "from-emerald-100 to-teal-100", ring: "ring-emerald-200" },
        { name: "Campagnes télécom CI", emoji: "📱", count: 5, hue: "from-indigo-100 to-blue-100", ring: "ring-indigo-200" },
      ]
      return (
        <div className="space-y-6">
          {/* Bandeau d'incitation */}
          <div className="rounded-2xl border border-[#F2B33D]/30 bg-gradient-to-br from-[#FFFBEC] via-white to-[#FFF6E5] p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F2B33D]/15">
                  <Heart className="h-6 w-6 text-[#F2B33D]" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-[#0F0F0F]">
                    Sauvegardez cette campagne dans une collection client
                  </h3>
                  <p className="mt-1.5 text-sm text-[#0F0F0F]/70 max-w-xl">
                    Créez des collections (pitch client, inspiration packshot, veille télécom…)
                    pour retrouver vos campagnes en un clic. Disponible avec <strong>Basic ou Pro</strong>.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Link href="/subscribe?plan=basic">
                  <Button className="w-full sm:w-auto bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F] font-semibold">
                    <Sparkles className="h-4 w-4 mr-2" />Passer en Basic
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" className="w-full sm:w-auto border-[#0F0F0F]/15">
                    Comparer Basic & Pro
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Aperçu : 3 collections fictives, désactivées */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#0F0F0F]/70 uppercase tracking-wide">
                Aperçu — exemples de collections
              </h4>
              <span className="text-xs text-[#0F0F0F]/40 inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> Verrouillé
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sampleCollections.map((c) => (
                <div
                  key={c.name}
                  aria-disabled="true"
                  className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.hue} ring-1 ${c.ring} p-5 transition-all hover:scale-[1.02] cursor-not-allowed`}
                >
                  <div className="absolute top-3 right-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm">
                      <Lock className="h-3.5 w-3.5 text-[#0F0F0F]/60" />
                    </div>
                  </div>
                  <div className="text-3xl mb-3" aria-hidden>{c.emoji}</div>
                  <div className="font-bold text-[#0F0F0F]">{c.name}</div>
                  <div className="mt-1 text-xs text-[#0F0F0F]/60">{c.count} campagnes sauvegardées</div>
                  <div className="mt-4 flex -space-x-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-7 w-7 rounded-md bg-white/70 ring-2 ring-white/80 backdrop-blur-sm" />
                    ))}
                    <div className="h-7 w-7 rounded-md bg-white/40 ring-2 ring-white/80 flex items-center justify-center text-[10px] font-bold text-[#0F0F0F]/60">
                      +{Math.max(0, c.count - 3)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Liste des avantages concrets */}
          <div className="rounded-2xl border border-[#F5F5F5] bg-white p-6">
            <h4 className="text-sm font-bold text-[#0F0F0F]/80 uppercase tracking-wide mb-4">
              Ce que vous débloquez
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                "Sauvegarde illimitée de campagnes",
                "Collections nommées par client / projet",
                "Partage de collections par lien",
                "Filtres avancés Pays / Secteur / Tags",
                "Téléchargement des visuels HD",
                "Accès aux campagnes Premium",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
                  <span className="text-[#0F0F0F]/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 p-8 text-center">
          <h3 className="text-lg font-semibold text-red-600">Erreur</h3>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button onClick={() => fetchFavoritesWithCampaigns()} className="mt-4" variant="outline">Réessayer</Button>
        </div>
      )
    }

    if (filteredCampaigns.length === 0) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#F5F5F5] bg-gradient-to-br from-[#f8fafc] to-[#f0f4ff] p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F5F5F5]">
            {activeCollection ? <FolderOpen className="h-10 w-10 text-[#F2B33D]/60" /> : <Heart className="h-10 w-10 text-[#F2B33D]/60" />}
          </div>
          <h3 className="mt-6 text-xl font-bold text-[#0F0F0F]">
            {activeCollection ? "Collection vide" : "Aucun favori"}
          </h3>
          <p className="mt-2 text-muted-foreground max-w-md">
            {activeCollection
              ? "Cette collection ne contient pas encore de campagne. Ajoutez-en depuis la bibliothèque."
              : "Vous n'avez pas encore de favoris. Explorez la bibliothèque et cliquez sur le \u2764\uFE0F pour sauvegarder vos campagnes préférées."}
          </p>
          <Link href="/dashboard" className="mt-6">
            <Button className="bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]">
              <ArrowLeft className="h-4 w-4 mr-2" />Explorer la bibliothèque
            </Button>
          </Link>
        </div>
      )
    }

    const activeCollectionMeta = activeCollection ? collections.find(c => c.id === activeCollection) : null
    const normalizedSearch = campaignSearch.trim().toLowerCase()
    const visibleCampaigns = [...filteredCampaigns]
      .filter((fav) => {
        const c = fav.campaign
        if (!c) return false
        if (!normalizedSearch) return true
        return [
          c.title,
          c.brand,
          c.category,
          c.country,
          ...(Array.isArray(c.platforms) ? c.platforms : []),
          ...(Array.isArray(c.tags) ? c.tags : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      })
      .sort((a, b) => {
        if (campaignSort === "title") {
          return (a.campaign?.title || "").localeCompare(b.campaign?.title || "", "fr")
        }
        const bDate = new Date(b.campaign?.created_at || 0).getTime()
        const aDate = new Date(a.campaign?.created_at || 0).getTime()
        return bDate - aDate
      })

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#E8EDF2] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0F0F0F]">
                <BookmarkCheck className="h-4 w-4 text-[#F2B33D]" />
                {filteredCampaigns.length} campagne{filteredCampaigns.length > 1 ? 's' : ''}
                {activeCollectionMeta && (
                  <span className="text-[#0F0F0F]/50">dans « {activeCollectionMeta.name} »</span>
                )}
              </p>
              <p className="mt-1 text-xs text-[#0F0F0F]/50">
                {visibleCampaigns.length} visible{visibleCampaigns.length > 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:w-[560px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F0F0F]/35" />
                <input
                  type="search"
                  aria-label={activeCollection ? "Rechercher dans la collection" : "Rechercher dans les favoris"}
                  value={campaignSearch}
                  onChange={(event) => setCampaignSearch(event.target.value)}
                  placeholder={activeCollection ? "Rechercher dans la collection" : "Rechercher un favori"}
                  className="h-10 w-full rounded-lg border border-[#E8EDF2] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0F0F0F] outline-none transition-colors placeholder:text-[#0F0F0F]/35 focus:border-[#F2B33D] focus:bg-white"
                />
              </label>
              <label className="relative block">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F0F0F]/35" />
                <select
                  aria-label="Trier les campagnes"
                  value={campaignSort}
                  onChange={(event) => setCampaignSort(event.target.value as "recent" | "title")}
                  className="h-10 w-full appearance-none rounded-lg border border-[#E8EDF2] bg-[#F8FAFC] pl-9 pr-3 text-sm font-medium text-[#0F0F0F] outline-none transition-colors focus:border-[#F2B33D] focus:bg-white"
                >
                  <option value="recent">Plus récentes</option>
                  <option value="title">Titre A-Z</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {visibleCampaigns.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCE4EC] bg-white p-8 text-center">
            <Search className="h-9 w-9 text-[#F2B33D]/70" />
            <h3 className="mt-4 text-lg font-bold text-[#0F0F0F]">Aucun résultat</h3>
            <p className="mt-2 max-w-md text-sm text-[#0F0F0F]/55">
              Aucune campagne ne correspond à cette recherche.
            </p>
            {campaignSearch && (
              <Button
                variant="outline"
                className="mt-5 border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                onClick={() => setCampaignSearch("")}
              >
                Effacer la recherche
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleCampaigns.map((fav) => {
            const c = fav.campaign!
            const isRemoving = removingId === fav.campaign_id
            return (
              <article key={fav.id} className={cn(
                "overflow-hidden rounded-2xl border border-[#E8EDF2] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#F2B33D]/40 hover:shadow-md",
                isRemoving && "opacity-50"
              )}>
                <Link href={`/content/${c.slug || c.id}`} className="group relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#0A1F44] to-[#1a3a6e]">
                  {c.thumbnail ? (
                    <Image
                      src={getGoogleDriveImageUrl(c.thumbnail)}
                      alt={c.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-3xl font-bold text-white/20">{c.title.substring(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                </Link>

                <div className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#0F0F0F]/55">
                    {Array.isArray(c.platforms) && c.platforms[0] && (
                      <span className="rounded-full bg-[#F4F8FB] px-2 py-1 font-medium">{c.platforms[0]}</span>
                    )}
                    {c.category && (
                      <span className="rounded-full bg-[#F4F8FB] px-2 py-1 font-medium">{c.category}</span>
                    )}
                  </div>

                  <Link href={`/content/${c.slug || c.id}`}>
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-base font-bold leading-snug text-[#0F0F0F] transition-colors hover:text-[#B8850A]">
                      {c.title}
                    </h3>
                  </Link>
                  <p className="mt-1 line-clamp-1 text-sm text-[#0F0F0F]/55">
                    {c.brand || c.country || "Campagne sauvegardée"}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className={cn(
                        "border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]",
                        !activeCollection && (!isPaid || collections.length === 0) && "col-span-2"
                      )}
                    >
                      <Link href={`/content/${c.slug || c.id}`}>Ouvrir</Link>
                    </Button>

                    {isPaid && collections.length > 0 && !activeCollection && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                            Classer
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Ajouter à...</p>
                          {collections.map((col) => {
                            const isIn = col.campaign_ids.includes(fav.campaign_id)
                            return (
                              <DropdownMenuItem
                                key={col.id}
                                onClick={() => isIn
                                  ? removeFromCollection(col.id, fav.campaign_id)
                                  : addToCollection(col.id, fav.campaign_id)
                                }
                                className={cn(isIn && "text-[#B8850A] font-semibold")}
                              >
                                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                                <span className="truncate">{col.name}</span>
                                {isIn && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {activeCollection ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCollection(activeCollection, fav.campaign_id)}
                        disabled={isRemoving}
                        className="border-red-100 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="h-3.5 w-3.5" />
                        Retirer
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemove(fav.campaign_id)}
                        disabled={isRemoving}
                        className="col-span-2 border-red-100 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Retirer des favoris
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── Rendu : grille de collections ────────────────

  const renderCollectionsGrid = () => {
    if (!isPaid) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#F5F5F5] bg-gradient-to-br from-[#f8fafc] to-[#f0f4ff] p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F2B33D]/10">
            <Lock className="h-10 w-10 text-[#F2B33D]/60" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-[#0F0F0F]">Fonctionnalité Premium</h3>
          <p className="mt-2 text-muted-foreground max-w-md">
            Les collections vous permettent d&apos;organiser vos campagnes favorites dans des collections thématiques et de les partager.
          </p>
          <Link href="/pricing" className="mt-6">
            <Button className="bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]">
              <Sparkles className="h-4 w-4 mr-2" />Voir les plans
            </Button>
          </Link>
        </div>
      )
    }

    if (collections.length === 0) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#F5F5F5] bg-gradient-to-br from-[#f8fafc] to-[#f0f4ff] p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F2B33D]/10">
            <FolderOpen className="h-10 w-10 text-[#F2B33D]/60" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-[#0F0F0F]">Aucune collection</h3>
          <p className="mt-2 text-muted-foreground max-w-md">
            Créez votre première collection pour organiser vos campagnes favorites par thème.
          </p>
          <Button className="mt-6 bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]" onClick={() => { setEditingCollection(null); setShowCollectionModal(true) }}>
            <FolderPlus className="h-4 w-4 mr-2" />Créer une collection
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#E8EDF2] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#0F0F0F]">Collections</h2>
            <p className="mt-1 text-sm text-[#0F0F0F]/55">
              {collections.length} collection{collections.length > 1 ? 's' : ''} · {collections.reduce((sum, col) => sum + col.item_count, 0)} campagne{collections.reduce((sum, col) => sum + col.item_count, 0) > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((col) => (
            <article
              key={col.id}
              className="rounded-2xl border border-[#E8EDF2] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#F2B33D]/40 hover:shadow-md"
            >
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveCollection(col.id)}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-xl text-left"
                  aria-label={`Ouvrir ${col.name}`}
                >
                  <CollectionCover
                    thumbnails={collectionThumbnails[col.id] || []}
                    name={col.name}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveCollection(col.id)}
                    className="block w-full text-left"
                  >
                    <h3 className="truncate text-base font-bold text-[#0F0F0F] transition-colors hover:text-[#B8850A]">
                      {col.name}
                    </h3>
                  </button>
                  <p className="mt-1 text-sm text-[#0F0F0F]/55">
                    {col.item_count} campagne{col.item_count !== 1 ? 's' : ''}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#F4F8FB] px-2 py-1 text-xs font-medium text-[#0F0F0F]/60">
                      <FolderOpen className="mr-1 h-3 w-3" />
                      Dossier
                    </span>
                    {col.is_shared && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        <Globe className="mr-1 h-3 w-3" />
                        Partagé
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                  onClick={() => setActiveCollection(col.id)}
                >
                  Ouvrir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                  onClick={() => openShareModal(col)}
                  disabled={sharingCollectionId === col.id}
                >
                  {sharingCollectionId === col.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                  Partager
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="col-span-2 border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => {
                      setEditingCollection({ id: col.id, name: col.name })
                      setShowCollectionModal(true)
                    }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Renommer
                    </DropdownMenuItem>
                    {col.is_shared && (
                      <DropdownMenuItem onClick={() => revokeShare(col.id)} className="text-orange-500">
                        <XCircle className="h-3.5 w-3.5 mr-2" />
                        Révoquer le partage
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => deleteCollection(col.id)} className="text-red-500 focus:text-red-500">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  // ─── Rendu : vue détail d'une collection ─────────

  const renderCollectionDetail = () => {
    const col = collections.find(c => c.id === activeCollection)
    if (!col) return null

    return (
      <div>
        <div className="mb-5 rounded-2xl border border-[#E8EDF2] bg-white p-4 shadow-sm sm:p-5">
          <button
            type="button"
            onClick={() => setActiveCollection(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#0F0F0F]/60 transition-colors hover:text-[#0F0F0F]"
          >
            <ChevronLeft className="h-4 w-4" />
            Collections
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E8EDF2]">
              <CollectionCover
                thumbnails={(collectionThumbnails[col.id] || []).slice(0, 3)}
                name={col.name}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold tracking-tight text-[#0F0F0F]">
                {col.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#0F0F0F]/55">
                <span>{col.item_count} campagne{col.item_count !== 1 ? 's' : ''}</span>
                {col.is_shared && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    <Globe className="mr-1 h-3 w-3" />
                    Partagé
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-auto">
              <Button
                variant="outline"
                className="border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                onClick={() => {
                  setEditingCollection({ id: col.id, name: col.name })
                  setShowCollectionModal(true)
                }}
              >
                <Pencil className="h-4 w-4" />
                Renommer
              </Button>
              <Button
                variant="outline"
                className="border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]"
                onClick={() => openShareModal(col)}
                disabled={sharingCollectionId === col.id}
              >
                {sharingCollectionId === col.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Partager
              </Button>
              {col.is_shared && (
                <Button
                  variant="outline"
                  className="border-orange-100 text-orange-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => revokeShare(col.id)}
                >
                  <XCircle className="h-4 w-4" />
                  Révoquer
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "border-[#E8EDF2] hover:border-[#F2B33D]/50 hover:bg-[#FFF6E3] hover:text-[#0F0F0F]",
                      !col.is_shared && "col-span-2"
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    Plus
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setActiveCollection(null)}>
                    <Grid3X3 className="h-3.5 w-3.5 mr-2" />
                    Toutes les collections
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => deleteCollection(col.id)} className="text-red-500 focus:text-red-500">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Grille de campagnes */}
        {renderFavoritesContent()}
      </div>
    )
  }

  // Garde abonnement : pas d'accès aux favoris tant que l'utilisateur n'a pas de plan actif.
  if (subChecking || subLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FB]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F2B33D] border-t-transparent" />
          <p className="text-sm text-[#0F0F0F]/70">
            {subLocked ? "On prépare votre accès Laveiye…" : "Chargement…"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F8FB]">
      {isAuthenticated ? <DashboardNavbar /> : <Navbar />}

      {/* Modal de partage */}
      <Dialog open={!!shareModalCollection} onOpenChange={(open) => !open && setShareModalCollection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-[#F2B33D]" />
              Partager « {shareModalCollection?.name} »
            </DialogTitle>
          </DialogHeader>
          {shareModalCollection?.share_token && (() => {
            const shareUrl = typeof window !== 'undefined'
              ? `${window.location.origin}/shared/${shareModalCollection.share_token}`
              : `/shared/${shareModalCollection.share_token}`
            const shareText = `Découvrez ma collection « ${shareModalCollection.name} » sur Laveiye !`
            const encodedUrl = encodeURIComponent(shareUrl)
            const encodedText = encodeURIComponent(shareText)

            const socials = [
              {
                name: 'WhatsApp',
                href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
                bg: 'bg-[#25D366] hover:bg-[#1ebe57]',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                ),
              },
              {
                name: 'X / Twitter',
                href: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
                bg: 'bg-black hover:bg-zinc-800',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                ),
              },
              {
                name: 'Facebook',
                href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                bg: 'bg-[#1877F2] hover:bg-[#166fe5]',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                ),
              },
              {
                name: 'LinkedIn',
                href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
                bg: 'bg-[#0A66C2] hover:bg-[#0958a8]',
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                ),
              },
            ]

            return (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  {socials.map((s) => (
                    <a
                      key={s.name}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-100",
                        s.bg
                      )}
                    >
                      {s.icon}
                      {s.name}
                    </a>
                  ))}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#F5F5F5]" /></div>
                  <div className="relative flex justify-center text-xs text-muted-foreground">
                    <span className="bg-white px-2">ou copier le lien</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-lg border border-[#F5F5F5] bg-[#F4F8FB] px-3 py-2 text-xs text-[#0F0F0F] outline-none select-all"
                    onFocus={e => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Lien copié !"); setShareModalCollection(null) }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#F2B33D] px-3 py-2 text-xs font-semibold text-[#0F0F0F] transition-colors hover:bg-[#E4A82F] hover:text-[#0F0F0F]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Copier
                  </button>
                </div>

                {shareModalCollection.is_shared && (
                  <button
                    type="button"
                    onClick={() => { revokeShare(shareModalCollection.id); setShareModalCollection(null) }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors pt-1"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Révoquer le lien public
                  </button>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 pb-12 pt-8">
          {/* Header */}
          <div className="mb-6 rounded-2xl border border-[#E8EDF2] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl shadow-sm",
                  activeTab === 'collections'
                    ? 'bg-[#F2B33D] text-[#0F0F0F] shadow-[#F2B33D]/20'
                    : 'bg-[#0F0F0F] text-white shadow-[#0F0F0F]/10'
                )}>
                  {activeTab === 'collections'
                    ? <Grid3X3 className="h-5 w-5" />
                    : <Heart className="h-5 w-5 fill-white" />
                  }
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#0F0F0F] sm:text-3xl">
                    {activeTab === 'collections' ? 'Collections' : 'Favoris'}
                  </h1>
                  <p className="mt-1 text-sm text-[#0F0F0F]/55">
                    {activeTab === 'collections'
                      ? `${collections.length} collection${collections.length > 1 ? 's' : ''}`
                      : `${campaigns.length} campagne${campaigns.length > 1 ? 's' : ''} sauvegardée${campaigns.length > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {activeTab === 'collections' && isPaid && !activeCollection && (
                <Button
                  className="bg-[#F2B33D] text-[#0F0F0F] hover:bg-[#E4A82F] hover:text-[#0F0F0F]"
                  onClick={() => { setEditingCollection(null); setShowCollectionModal(true) }}
                >
                  <FolderPlus className="h-4 w-4" />
                  Nouvelle collection
                </Button>
              )}
            </div>

            <div className="mt-5 inline-flex rounded-xl border border-border bg-muted p-1" role="tablist" aria-label="Favoris et collections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'favorites'}
                onClick={() => { router.push('/favorites'); setActiveCollection(null) }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  activeTab === 'favorites'
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <Heart className="h-4 w-4" />
                Favoris
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'collections'}
                onClick={() => { router.push('/favorites?tab=collections'); setActiveCollection(null) }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  activeTab === 'collections'
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                Collections
                {!isPaid && <Lock className="h-3 w-3 ml-1 opacity-40" />}
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div>
            {activeTab === 'collections' && activeCollection && isPaid ? (
              renderCollectionDetail()
            ) : activeTab === 'collections' ? (
              renderCollectionsGrid()
            ) : (
              renderFavoritesContent()
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Modal de création/édition de collection */}
      <CollectionModal
        open={showCollectionModal}
        onOpenChange={(open) => {
          setShowCollectionModal(open)
          if (!open) setEditingCollection(null)
        }}
        editingCollection={editingCollection}
        onSave={handleCollectionModalSave}
      />
    </div>
  )
}

export default function FavoritesPage() {
  return (
    <Suspense>
      <FavoritesPageContent />
    </Suspense>
  )
}
