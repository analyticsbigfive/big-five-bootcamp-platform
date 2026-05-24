﻿"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { TempsFortsBanner } from "@/components/temps-forts/temps-forts-banner"
import { TempsFortsPopup } from "@/components/temps-forts/temps-forts-popup"
import type { DynamicFilterOptions } from "@/components/dashboard/filters-sidebar"
import { ContentCard, ContentItem } from "@/components/dashboard/content-card"
import { ContentGridSkeleton } from "@/components/dashboard/content-card-skeleton"
import { UpgradePopup, useUpgradePopup } from "@/components/upgrade-popup"
import { useRequireActiveSubscription } from "@/hooks/use-require-active-subscription"
import { BasicToProBanner } from "@/components/basic-to-pro-banner"
import { getDashboardCampaigns } from "@/app/actions/creative"
import { useAuthContext } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Filter, Grid3X3, LayoutList, ChevronLeft, ChevronRight, CalendarDays, TrendingUp, ChevronRight as ArrowRight, Sparkles, Rss, CheckCircle2 } from "lucide-react"
import { format, parseISO, startOfWeek, subDays } from "date-fns"
import { fr } from "date-fns/locale"
import { isPaidPlan, canAccessPremiumContent } from "@/lib/pricing"
import { fixBrokenEncoding } from "@/lib/utils"

const ParticlesBackground = dynamic(() => import("@/components/ui/particles-background").then(m => m.ParticlesBackground), { ssr: false })
const FiltersSidebar = dynamic(() => import("@/components/dashboard/filters-sidebar").then(m => m.FiltersSidebar))
const SwipeableCarousel = dynamic(() => import("@/components/ui/swipeable-carousel").then(m => m.SwipeableCarousel), { ssr: false })

// Compteur mensuel de clics (côté serveur via API)
const MONTHLY_CLICK_LIMIT = 10

// Normalisation des noms de pays pour corriger les imports CSV mal encodés
// Ex: "Cote d'Ivoire" (ASCII) → "Côte d'Ivoire" (UTF-8 canonique)
const COUNTRY_ALIASES: Record<string, string> = {
  "cote d'ivoire":        "Côte d'Ivoire",
  "côte d'ivoire":        "Côte d'Ivoire",
  "senegal":              "Sénégal",
  "sénégal":              "Sénégal",
  "benin":                "Bénin",
  "bénin":                "Bénin",
  "guinee":               "Guinée",
  "guinée":               "Guinée",
  "guinee-bissau":        "Guinée-Bissau",
  "guinée-bissau":        "Guinée-Bissau",
  "mali":                 "Mali",
  "niger":                "Niger",
  "togo":                 "Togo",
  "burkina faso":         "Burkina Faso",
  "cameroun":             "Cameroun",
  "cameroon":             "Cameroun",
}

function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return ""
  const trimmed = raw.trim()
  // Remplace le caractère de remplacement U+FFFD par la lettre correcte
  // Ex: "C\uFFFDte d'Ivoire" → "Côte d'Ivoire"
  const degarbled = trimmed.replace(/C\uFFFDte d['']Ivoire/i, "Côte d'Ivoire")
  return COUNTRY_ALIASES[degarbled.toLowerCase()] ?? degarbled
}

function getSearchQuotaMonthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

function stableSearchFilterEntries(filters: Record<string, string[]>): Array<[string, string[]]> {
  return Object.entries(filters)
    .map(([category, values]) => {
      const normalizedValues = Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'fr'))
      return [category, normalizedValues] as [string, string[]]
    })
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
}

function countedSearchKey(query: string, filters: Record<string, string[]>): string {
  return JSON.stringify({
    month: getSearchQuotaMonthKey(),
    query: query.trim().toLowerCase(),
    filters: stableSearchFilterEntries(filters),
  })
}

// Les compteurs de clics sont maintenant gérés côté serveur via /api/track-click

// Mélange aléatoire (Fisher-Yates) pour l'affichage des campagnes
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Mapping campagne brute (Supabase) → ContentItem (UI). Centralisé pour que
// le bloc "Suivi de marques" puisse réutiliser le même format que la liste
// principale, sans dépendre du chargement préalable du state `campaigns`.
function mapCampaignToContentItem(campaign: any): ContentItem {
  return {
    id: campaign.id,
    title: fixBrokenEncoding(campaign.title),
    summary: fixBrokenEncoding(campaign.summary),
    description: fixBrokenEncoding(campaign.description),
    imageUrl: campaign.thumbnail || '',
    platform: campaign.platforms?.[0] || 'Facebook',
    country: normalizeCountry(campaign.country),
    sector: fixBrokenEncoding(campaign.category) || '',
    format: campaign.format || '',
    tags: campaign.tags || [],
    date: new Date(campaign.created_at).toISOString().split('T')[0],
    isVideo: !!campaign.video_url,
    images: campaign.images || [],
    videoUrl: campaign.video_url || undefined,
    brand: fixBrokenEncoding(campaign.brand) || '',
    agency: fixBrokenEncoding(campaign.agency) || '',
    year: campaign.year || undefined,
    axe: campaign.axe || [],
    analyse: fixBrokenEncoding(campaign.analyse) || undefined,
    howToUse: fixBrokenEncoding(campaign.how_to_use) || undefined,
    status: campaign.status,
    accessLevel: campaign.access_level || 'free',
    createdAt: campaign.created_at,
    featured: campaign.featured || false,
    publicationUrl: campaign.publication_url || '',
    tempsFortSlugs: campaign.temps_fort_slugs || [],
  }
}

function PaginationPageButton({ page, isActive, onClick }: { page: number; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 w-10 rounded-lg text-sm font-bold transition-all duration-200 ${isActive
        ? "bg-[#F2B33D] text-white shadow-lg shadow-[#F2B33D]/30 scale-110"
        : "bg-background border-2 border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-[#F2B33D]/30"
        }`}
    >
      {page}
    </button>
  )
}

function PaginationBar({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInput, setPageInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleGoToPage = () => {
    const page = parseInt(pageInput, 10)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
    setIsEditingPage(false)
    setPageInput("")
  }

  useEffect(() => {
    if (isEditingPage && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditingPage])

  // Determine which pages to show: first 2, last 2, and current page neighborhood
  const showEllipsis = totalPages > 5
  const firstPages = [1, 2].filter(p => p <= totalPages)
  const lastPages = [totalPages - 1, totalPages].filter(p => p > 2)
  const isCurrentPageVisible = firstPages.includes(currentPage) || lastPages.includes(currentPage)

  const handlePageInputOpen = () => {
    setPageInput(String(currentPage))
    setIsEditingPage(true)
  }

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 border-2 border-border bg-background p-0 hover:bg-muted hover:border-[#F2B33D]/30"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        {showEllipsis ? (
          <>
            {firstPages.map((page) => (
              <PaginationPageButton
                key={page}
                page={page}
                isActive={currentPage === page}
                onClick={() => onPageChange(page)}
              />
            ))}

            {isEditingPage ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleGoToPage() }}
                className="flex items-center"
              >
                <input
                  ref={inputRef}
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handleGoToPage}
                  placeholder={String(currentPage)}
                  className="h-10 w-14 rounded-lg border-2 border-[#F2B33D]/40 bg-background text-center text-sm font-bold text-foreground outline-none focus:border-[#F2B33D] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </form>
            ) : !isCurrentPageVisible ? (
              <PaginationPageButton
                page={currentPage}
                isActive={true}
                onClick={handlePageInputOpen}
              />
            ) : (
              <button
                type="button"
                onClick={handlePageInputOpen}
                className="h-10 min-w-10 rounded-lg border-2 border-dashed border-border bg-background px-2 text-sm font-bold text-muted-foreground transition-all hover:border-[#F2B33D]/40 hover:text-[#F2B33D]"
                title="Aller à une page"
              >
                ···
              </button>
            )}

            {lastPages.map((page) => (
              <PaginationPageButton
                key={page}
                page={page}
                isActive={currentPage === page}
                onClick={() => onPageChange(page)}
              />
            ))}
          </>
        ) : (
          Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PaginationPageButton
              key={page}
              page={page}
              isActive={currentPage === page}
              onClick={() => onPageChange(page)}
            />
          ))
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-10 w-10 border-2 border-border bg-background p-0 hover:bg-muted hover:border-[#F2B33D]/30"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  // Force le choix d'un plan : redirige vers /subscribe?required=1
  // si l'utilisateur n'a pas d'abonnement actif (plan Free desactive).
  const { checking: subChecking, locked: subLocked } = useRequireActiveSubscription()

  const router = useRouter()
  const searchParams = useSearchParams()
  const brandFilter = searchParams.get("brand") ?? ""
  const tempsFortFilter = searchParams.get("temps_fort") ?? ""
  const initialSearch = searchParams.get("search") ?? ""

  const [campaigns, setCampaigns] = useState<ContentItem[]>([])
  const [weeklyCampaigns, setWeeklyCampaigns] = useState<ContentItem[]>([])
  // Bloc "À explorer pour votre suivi de marques" — un sous-bloc par demande approuvée+payée.
  // Source : /api/dashboard/brand-monitoring (filtrage serveur : marque + pays + secteurs + canaux).
  // On garde à la fois les IDs (résolus contre `campaigns` déjà formaté quand possible)
  // et les payloads bruts en fallback — utile si une campagne renvoyée par l'API admin
  // n'est pas dans le state local (course de chargement, ou RLS divergent).
  const [brandMonitoringGroups, setBrandMonitoringGroups] = useState<Array<{
    requestId: string
    brandName: string
    countries: string[]
    sectors: string[]
    channels: string[]
    nextRenewalAt: string | null
    autoRenew: boolean | null
    contentIds: string[]
    rawContents: any[]
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({})
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [activeQuickFilter, setActiveQuickFilter] = useState("Tous")
  // Pré-remplir la recherche depuis ?brand=X (lien direct depuis notification/email)
  // ou ?search=X (navbar utilisée depuis une autre page).
  // `searchQuery` = ce que l'utilisateur tape (live, sert aux suggestions).
  // `committedSearchQuery` = ce qui filtre réellement les résultats. Ne change
  // QUE sur action explicite (Enter, clic suggestion, clic tag filtre, vidage,
  // ou deeplink `?search=` / `?brand=`). Évite que l'utilisateur voie les
  // résultats avant de soumettre — sinon il peut consommer le contenu sans
  // déclencher le décompte du quota.
  const [searchQuery, setSearchQuery] = useState(() => brandFilter || initialSearch)
  const [committedSearchQuery, setCommittedSearchQuery] = useState(() => brandFilter || initialSearch)
  const itemsPerPage = 9

  // Quota de recherches+filtres / mois, compteur partage (Découverte: 5, Basic: 30, Pro: illimité)
  const [searchQuota, setSearchQuota] = useState<{
    counts: Record<string, number>
    limit: number | null
    tier: 'discovery' | 'basic' | 'pro'
  }>({ counts: {}, limit: null, tier: 'discovery' })

  // Mémorise la dernière recherche déjà comptabilisée pour éviter de la recompter.
  // La clé inclut aussi les filtres et le mois de quota : une même requête dans
  // un contexte différent peut donc être comptée, sans double compter la frappe.
  // Pré-marquage : SEUL `?brand=…` (deeplink suivi de marques) ne doit pas
  // consommer de quota. `?search=…` est une recherche utilisateur (depuis
  // navbar sur page detail, suggestion, etc.) → doit etre comptee.
  const lastCountedSearchRef = useRef<string>(brandFilter ? countedSearchKey(brandFilter, {}) : "")

  useEffect(() => {
    const next = brandFilter || initialSearch
    setSearchQuery(next)
    // Deeplink : on commit immédiatement pour afficher les résultats.
    setCommittedSearchQuery(next)
    setCurrentPage(1)
    // Pré-marquer UNIQUEMENT les arrivees via `?brand=…` (suivi de marques).
    // Les `?search=…` arrivent via navbar (déjà comptés ailleurs).
    if (brandFilter) {
      lastCountedSearchRef.current = countedSearchKey(next, selectedFilters)
    }
    // `selectedFilters` est volontairement exclu : les filtres sont hydrates
    // par l'effet URL juste apres, et un deeplink `?brand=...` ne consomme pas
    // de quota meme quand ces filtres arrivent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandFilter, initialSearch])

  // Hydrate les filtres depuis l'URL (?country=A,B&sector=X,Y&platform=Z).
  // Utilisé par les deeplinks "Voir tout" du bloc Suivi de marques pour pré-cocher
  // les filtres existants du dashboard sans dupliquer la logique.
  const urlCountries = searchParams.get('country') ?? ''
  const urlSectors = searchParams.get('sector') ?? ''
  const urlPlatforms = searchParams.get('platform') ?? ''
  useEffect(() => {
    const splitCsv = (s: string) =>
      s.split(',').map((v) => v.trim()).filter(Boolean)
    const countryArr = splitCsv(urlCountries)
    const sectorArr = splitCsv(urlSectors)
    // L'URL utilise les codes courts (facebook, instagram…) ; les filtres dashboard
    // attendent les libellés ("Facebook", "Instagram", …).
    const platformLabel: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      linkedin: 'LinkedIn',
      x: 'Twitter/X',
      tiktok: 'TikTok',
      youtube: 'YouTube',
    }
    const platformArr = splitCsv(urlPlatforms).map(
      (p) => platformLabel[p.toLowerCase()] ?? p
    )

    setSelectedFilters((prev) => {
      const next = { ...prev }
      if (countryArr.length > 0) next['Pays'] = countryArr
      else delete next['Pays']
      if (sectorArr.length > 0) next['Secteur'] = sectorArr
      else delete next['Secteur']
      if (platformArr.length > 0) next['Plateforme'] = platformArr
      else delete next['Plateforme']
      return next
    })
    setCurrentPage(1)
  }, [urlCountries, urlSectors, urlPlatforms])

  const clearBrandFilter = useCallback(() => {
    setSearchQuery("")
    setCommittedSearchQuery("")
    setCurrentPage(1)
    router.replace("/dashboard")
  }, [router])

  const { open: upgradeOpen, reason: upgradeReason, showUpgrade, closeUpgrade } = useUpgradePopup()

  // Auth centralisé — AUCUN appel getUser() ni requête DB ici
  const {
    userPlan,
    isFreeUser,
    monthlyClicks,
    monthlyExplored,
    refreshClickCounters,
  } = useAuthContext()

  // Extraire les options de filtres dynamiquement depuis les campagnes
  const dynamicFilterOptions = useMemo<DynamicFilterOptions>(() => {
    const countries = new Set<string>()
    const sectors = new Set<string>()
    const formats = new Set<string>()
    const platforms = new Set<string>()
    const tags = new Set<string>()
    const years = new Set<number>()
    const axes = new Set<string>()

    campaigns.forEach((campaign) => {
      if (campaign.country) countries.add(normalizeCountry(campaign.country))
      if (campaign.sector) sectors.add(campaign.sector)
      if (campaign.format) formats.add(campaign.format)
      if (campaign.platform) platforms.add(campaign.platform)
      if (campaign.year) years.add(campaign.year)
      if (campaign.tags && Array.isArray(campaign.tags)) {
        campaign.tags.forEach((tag) => {
          if (tag) tags.add(tag)
        })
      }
      if (campaign.axe && Array.isArray(campaign.axe)) {
        campaign.axe.forEach((a) => {
          if (a) axes.add(a)
        })
      }
    })

    return {
      countries: Array.from(countries),
      sectors: Array.from(sectors),
      formats: Array.from(formats),
      platforms: Array.from(platforms),
      tags: Array.from(tags),
      years: Array.from(years),
      axes: Array.from(axes),
    }
  }, [campaigns])

  // Suggestions d'autocompl\u00e9tion pour la barre de recherche \u2014 collecte
  // marques, agences, secteurs, pays, plateformes et tags depuis les campagnes.
  const searchSuggestions = useMemo<string[]>(() => {
    const set = new Set<string>()
    campaigns.forEach((c) => {
      if (c.brand) set.add(c.brand)
      if (c.agency) set.add(c.agency)
      if (c.sector) set.add(c.sector)
      if (c.country) set.add(normalizeCountry(c.country))
      if (c.platform) set.add(c.platform)
      if (c.format) set.add(c.format)
      c.tags?.forEach((t) => t && set.add(t))
      c.axe?.forEach((a) => a && set.add(a))
    })
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [campaigns])

  // Charger les campagnes publiees via server action (filtrage premium côté serveur :
  // les champs analyse/how_to_use ne sont jamais envoyés à un compte non-premium).
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const { success, data, error } = await getDashboardCampaigns()

        if (!success) {
          console.warn('Chargement campagnes échoué:', error)
          setCampaigns(getSampleCampaigns())
          return
        }

        if (!data || data.length === 0) {
          setCampaigns(getSampleCampaigns())
          return
        }

        const formattedCampaigns: ContentItem[] = (data || []).map(mapCampaignToContentItem)

        // Mélanger aléatoirement les campagnes pour varier l'affichage
        setCampaigns(shuffleArray(formattedCampaigns))

        // Filtrer les campagnes de la semaine
        // Priorité 1 : campagnes marquées "featured" par l'admin
        // Priorité 2 : campagnes ajoutées dans les 7 derniers jours
        const lastMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
        const featuredCampaigns = formattedCampaigns.filter(c => c.featured)
        const recentCampaigns = formattedCampaigns.filter(c => {
          const date = new Date(c.createdAt || c.date)
          return date >= lastMonday && !c.featured
        })
        // Featured d'abord, puis les récentes
        const weekly = [...featuredCampaigns, ...recentCampaigns]
        setWeeklyCampaigns(weekly)
      } catch (error: any) {
        console.warn('Erreur chargement campagnes:', error?.message || error)
        setCampaigns(getSampleCampaigns())
      } finally {
        setIsLoading(false)
      }
    }

    loadCampaigns()
  }, [])

  // Charger les groupes "Suivi de marques" : un sous-bloc par demande approuvée+payée.
  // Le serveur applique les filtres marque/pays/secteur/canaux ; on stocke uniquement
  // les IDs côté client pour réutiliser le mapping ContentItem du state `campaigns`.
  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/brand-monitoring?limit=12')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.groups) return
        const groups = (data.groups as Array<any>).map((g) => {
          const rawContents = Array.isArray(g.contents) ? g.contents : []
          return {
            requestId: String(g.requestId),
            brandName: String(g.brandName || ''),
            countries: Array.isArray(g.countries) ? g.countries : [],
            sectors: Array.isArray(g.sectors) ? g.sectors : [],
            channels: Array.isArray(g.channels) ? g.channels : [],
            nextRenewalAt: g.nextRenewalAt || null,
            autoRenew: g.autoRenew ?? null,
            contentIds: rawContents.map((c: any) => String(c.id)).filter(Boolean),
            rawContents,
          }
        })
        setBrandMonitoringGroups(groups)
      })
      .catch(() => { /* silencieux : feature optionnelle */ })
    return () => { cancelled = true }
  }, [])

  // Charger l'\u00e9tat initial du quota mensuel partage (recherches+filtres)
  useEffect(() => {
    let cancelled = false
    fetch('/api/track-search')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSearchQuota({
          counts: data.counts || {},
          limit: data.limit ?? null,
          tier: data.tier ?? 'discovery',
        })
      })
      .catch(() => { /* silencieux */ })
    return () => { cancelled = true }
  }, [])

  // Comptabiliser la barre de recherche textuelle comme un "filtre" (catégorie "Recherche").
  // Débounce de 800ms : on ne compte qu'une fois la frappe stabilisée, et seulement
  // si la requête a changé par rapport à la dernière comptabilisée.
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) return
    const searchKey = countedSearchKey(q, selectedFilters)
    if (searchKey === lastCountedSearchRef.current) return

    // DÉSACTIVÉ : ne plus compter automatiquement sur frappe.
    // Le quota est débité UNIQUEMENT sur action explicite :
    //   - clic sur un tag de filtre (handleFilterChange)
    //   - submit Enter dans la barre (handleSubmitSearch)
    //   - clic sur une suggestion d'autocomplétion (handleSubmitSearch via navbar)
    return

    // eslint-disable-next-line no-unreachable
    const handle = setTimeout(async () => {
      // Regle metier : recherche sans resultat ne consomme pas de quota.
      if (countMatching(selectedFilters, q) === 0) {
        lastCountedSearchRef.current = searchKey
        return
      }

      // Pr\u00e9-blocage local : si la limite est d\u00e9j\u00e0 atteinte, on bloque sans hit API.
      if (searchQuota.limit !== null) {
        const used = searchQuota.counts['_shared'] || 0
        if (used >= searchQuota.limit) {
          showUpgrade('searches-bar')
          setSearchQuery("")
          return
        }
      }

      try {
        const res = await fetch('/api/track-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterId: 'Recherche',
            query: q,
            filters: selectedFilters,
            source: 'bar',
          }),
        })
        if (res.status === 403) {
          try {
            const data = await res.json()
            if (data?.counts) {
              setSearchQuota((s) => ({ ...s, counts: data.counts, limit: data.limit ?? s.limit }))
            }
          } catch { /* ignore */ }
          showUpgrade('searches-bar')
          setSearchQuery("")
          return
        }
        if (res.ok) {
          lastCountedSearchRef.current = searchKey
          try {
            const data = await res.json()
            if (data?.counts) {
              setSearchQuota({
                counts: data.counts,
                limit: data.limit ?? null,
                tier: data.tier ?? 'discovery',
              })
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Erreur r\u00e9seau : on n'incr\u00e9mente pas localement, on r\u00e9essayera \u00e0 la prochaine frappe stable.
      }
    }, 800)

    return () => clearTimeout(handle)
    // On ne relance pas seulement parce qu'un filtre change : `handleFilterChange`
    // comptabilise déjà les filtres ajoutes. La clé de déduplication inclut les
    // filtres pour autoriser un nouveau comptage quand la recherche est relancée
    // dans un contexte différent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  // Données d'exemple
  const getSampleCampaigns = (): ContentItem[] => [
    {
      id: "sample-1",
      title: "Campagne MTN Mobile Money",
      description: "Campagne digitale pour le lancement de MTN MoMo en Côte d'Ivoire",
      imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
      platform: "Facebook",
      country: "Côte d'Ivoire",
      sector: "Telecoms",
      format: "Vidéo",
      tags: ["Mobile Money", "Fintech", "Digital"],
      date: new Date().toISOString().split('T')[0],
      isVideo: true,
      brand: "MTN",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
    {
      id: "sample-2",
      title: "Lancement Coca-Cola Zero Sugar",
      description: "Campagne 360° pour le nouveau Coca-Cola Zero Sugar",
      imageUrl: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800",
      platform: "Instagram",
      country: "Sénégal",
      sector: "FMCG",
      format: "Image",
      tags: ["Boisson", "Lancement produit"],
      date: new Date().toISOString().split('T')[0],
      isVideo: false,
      brand: "Coca-Cola",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
    {
      id: "sample-3",
      title: "Orange Bank Africa",
      description: "Campagne de sensibilisation aux services bancaires mobiles",
      imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
      platform: "YouTube",
      country: "Burkina Faso",
      sector: "Banque/Finance",
      format: "Vidéo",
      tags: ["Banque mobile", "Digital", "Fintech"],
      date: "2024-03-10",
      isVideo: true,
      brand: "Orange",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
    {
      id: "sample-4",
      title: "Nestlé Maggi Cube",
      description: "Campagne TV et digital pour Maggi en Afrique de l'Ouest",
      imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
      platform: "TikTok",
      country: "Bénin",
      sector: "FMCG",
      format: "Vidéo",
      tags: ["Alimentaire", "FMCG", "Cuisine"],
      date: "2024-01-25",
      isVideo: true,
      brand: "Nestlé",
      agency: "Laveiye",
      year: 2024,
      status: "Publié",
    },
  ]

  // Quick filters
  const quickFilters = useMemo(() => {
    const sectorCounts: Record<string, number> = {}
    campaigns.forEach((campaign) => {
      if (campaign.sector) {
        sectorCounts[campaign.sector] = (sectorCounts[campaign.sector] || 0) + 1
      }
    })

    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sector]) => ({
        label: sector,
        type: "sector" as const,
        value: sector,
      }))

    return [
      { label: "Tous", type: "all" as const, value: "all" },
      ...topSectors,
    ]
  }, [campaigns])

  const handleQuickFilter = (filter: { label: string; type: string; value: string }) => {
    setActiveQuickFilter(filter.label)
    setCurrentPage(1)

    if (filter.type === "all") {
      setSelectedFilters({})
    } else if (filter.type === "sector") {
      setSelectedFilters({ "Secteur": [filter.value] })
    } else if (filter.type === "tag") {
      setSelectedFilters({ "Tags": [filter.value] })
    }
  }

  const matchesFiltersAndQuery = useCallback(
    (content: ContentItem, filters: Record<string, string[]>, query: string) => {
      const brandNeedle = brandFilter.trim().toLowerCase()

      if (tempsFortFilter) {
        if (!content.tempsFortSlugs?.includes(tempsFortFilter)) return false
      }

      if (brandNeedle) {
        const brandMatch =
          (content.brand || '').toLowerCase().includes(brandNeedle) ||
          content.title.toLowerCase().includes(brandNeedle) ||
          content.tags?.some(t => t.toLowerCase().includes(brandNeedle))
        if (!brandMatch) return false
      }

      const q = query.trim().toLowerCase()
      if (q) {
        const matchesSearch =
          content.title.toLowerCase().includes(q) ||
          content.description?.toLowerCase().includes(q) ||
          content.brand?.toLowerCase().includes(q) ||
          content.agency?.toLowerCase().includes(q) ||
          content.sector?.toLowerCase().includes(q) ||
          content.platform?.toLowerCase().includes(q) ||
          content.country?.toLowerCase().includes(q) ||
          content.tags?.some(tag => tag.toLowerCase().includes(q)) ||
          content.axe?.some(a => a.toLowerCase().includes(q))
        if (!matchesSearch) return false
      }

      const countryFilter = filters["Pays"] || []
      const sectorFilter = filters["Secteur"] || []
      const formatFilter = filters["Format"] || []
      const platformFilter = filters["Plateforme"] || []
      const tagsFilter = filters["Tags"] || []
      const axeFilter = filters["Axe créatif"] || []
      const yearFilter = filters["Année"] || []

      if (countryFilter.length > 0 && !countryFilter.includes(normalizeCountry(content.country))) return false
      if (sectorFilter.length > 0 && !sectorFilter.includes(content.sector)) return false
      if (formatFilter.length > 0 && !formatFilter.includes(content.format)) return false
      if (platformFilter.length > 0 && !platformFilter.includes(content.platform)) return false
      if (tagsFilter.length > 0 && !content.tags.some(tag => tagsFilter.includes(tag))) return false
      if (axeFilter.length > 0 && (!content.axe || !content.axe.some(a => axeFilter.includes(a)))) return false
      if (yearFilter.length > 0 && content.year && !yearFilter.includes(String(content.year))) return false

      return true
    },
    [brandFilter, tempsFortFilter]
  )

  // Compte le nombre de campagnes correspondant à un jeu de filtres + une requête.
  // Utilisé pour décider si on doit comptabiliser ou non la recherche dans le quota.
  const countMatching = useCallback(
    (filters: Record<string, string[]>, query: string) =>
      campaigns.reduce((n, c) => (matchesFiltersAndQuery(c, filters, query) ? n + 1 : n), 0),
    [campaigns, matchesFiltersAndQuery]
  )

  const filteredContent = useMemo(() => {
    // Utilise `committedSearchQuery` (pas `searchQuery` live) : les résultats
    // ne se mettent à jour que sur soumission explicite.
    return campaigns.filter((content) => matchesFiltersAndQuery(content, selectedFilters, committedSearchQuery))
  }, [selectedFilters, campaigns, committedSearchQuery, matchesFiltersAndQuery])

  // Appliquer les mêmes filtres aux campagnes de la semaine
  const filteredWeeklyCampaigns = useMemo(() => {
    const filteredIds = new Set(filteredContent.map(c => c.id))
    return weeklyCampaigns.filter(c => filteredIds.has(c.id))
  }, [weeklyCampaigns, filteredContent])

  // Index ContentItem par id pour résoudre les `contentIds` renvoyés par l'API
  // brand-monitoring sans ré-implémenter le mapping campaigns→ContentItem.
  const campaignById = useMemo(() => {
    const m = new Map<string, ContentItem>()
    for (const c of campaigns) m.set(String(c.id), c)
    return m
  }, [campaigns])

  // Groupes brand-monitoring résolus en ContentItem prêts à afficher.
  // Pour chaque ID renvoyé par l'API, on tente d'abord le state local
  // (campagnes formatées et mélangées) ; à défaut, on mappe le payload brut
  // de l'API. Cela évite que le bloc reste invisible si `campaigns` n'est pas
  // encore chargé ou si une RLS divergente cache une campagne côté client.
  const resolvedBrandMonitoringGroups = useMemo(() => {
    if (brandMonitoringGroups.length === 0) return []
    return brandMonitoringGroups
      .map((g) => {
        const rawById = new Map<string, any>()
        for (const c of g.rawContents) {
          if (c?.id) rawById.set(String(c.id), c)
        }
        const contents = g.contentIds
          .map((id) => {
            const local = campaignById.get(id)
            if (local) return local
            const raw = rawById.get(id)
            return raw ? mapCampaignToContentItem(raw) : undefined
          })
          .filter((c): c is ContentItem => Boolean(c))
        return { ...g, contents }
      })
      .filter((g) => g.contents.length > 0)
  }, [brandMonitoringGroups, campaignById])

  // Construit le deeplink "Voir tout" : /dashboard?brand=X&country=Y&sector=Z&platform=W
  // Réutilise les params déjà compris par le filtre principal du dashboard.
  const buildBrandMonitoringDeepLink = useCallback(
    (g: { brandName: string; countries: string[]; sectors: string[]; channels: string[] }) => {
      const params = new URLSearchParams()
      params.set('brand', g.brandName)
      if (g.countries.length > 0) params.set('country', g.countries.join(','))
      if (g.sectors.length > 0) params.set('sector', g.sectors.join(','))
      if (g.channels.length > 0) params.set('platform', g.channels.join(','))
      return `/dashboard?${params.toString()}`
    },
    [],
  )

  const handleContentClick = useCallback(async (_content: ContentItem): Promise<boolean> => {
    // Gate Premium : les campagnes "premium" sont réservées aux abonnés Basic ou Pro.
    // Les comptes Découverte (Free) doivent passer en Basic ou Pro pour y accéder.
    if (_content.accessLevel === 'premium' && !canAccessPremiumContent(userPlan)) {
      showUpgrade("premium")
      return false
    }
    // Le tracking est désormais fait par la page détail au chargement du contenu.
    // Ici on se contente de vérifier si l'utilisateur est déjà bloqué pour
    // empêcher la navigation et afficher l'upgrade.
    try {
      const res = await fetch('/api/track-click') // GET
      if (res.ok) {
        const data = await res.json()
        if (data.isFree && data.limit != null && (data.clicks || 0) >= data.limit) {
          showUpgrade("clicks")
          return false
        }
      }
    } catch {
      // En cas d'erreur réseau, laisser passer
    }
    return true
  }, [showUpgrade, userPlan])

  const accessibleContent = filteredContent
  const totalPages = Math.ceil(accessibleContent.length / itemsPerPage)
  const paginatedContent = accessibleContent.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Grouper les campagnes par mois/année
  const groupedContent = useMemo(() => {
    const groups: Record<string, ContentItem[]> = {}

    paginatedContent.forEach((content) => {
      let monthKey: string
      try {
        const date = parseISO(content.date)
        monthKey = format(date, "MMMM yyyy", { locale: fr })
      } catch {
        monthKey = content.year ? `Année ${content.year}` : "Non daté"
      }

      if (!groups[monthKey]) {
        groups[monthKey] = []
      }
      groups[monthKey].push(content)
    })

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const getYear = (key: string) => {
        const match = key.match(/\d{4}/)
        return match ? parseInt(match[0]) : 0
      }
      const getMonth = (key: string) => {
        const months = ["janvier", "février", "mars", "avril", "mai", "juin",
          "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
        const lowerKey = key.toLowerCase()
        const idx = months.findIndex(m => lowerKey.includes(m))
        return idx >= 0 ? idx : 0
      }

      const yearA = getYear(a)
      const yearB = getYear(b)
      if (yearA !== yearB) return yearB - yearA
      return getMonth(b) - getMonth(a)
    })

    return sortedKeys.map(key => ({
      monthYear: key,
      campaigns: groups[key]
    }))
  }, [paginatedContent])

  /**
   * Soumission explicite de la barre de recherche (Enter ou clic suggestion).
   * Débite le quota mensuel UNIQUEMENT si :
   *   - la requête est non-vide
   *   - elle diffère de la précédente déjà comptée
   *   - elle retourne au moins un résultat (combinée aux filtres actifs)
   *   - l'utilisateur n'a pas déjà atteint sa limite
   */
  const handleSubmitSearch = async (rawQuery: string) => {
    const q = (rawQuery || '').trim()
    if (!q) {
      // Soumission d'une chaîne vide = vider la recherche affichée.
      setCommittedSearchQuery('')
      return
    }
    // Commit immédiat : c'est ce qui déclenche l'affichage des résultats.
    setCommittedSearchQuery(q)
    setCurrentPage(1)

    // Verrou anti-doublon : on set la ref AVANT l'appel async pour empêcher
    // qu'un second submit (clic suggestion + Enter rapide) déclenche un
    // 2e tracking pendant que le 1er est encore in-flight.
    if (q === lastCountedSearchRef.current) return
    lastCountedSearchRef.current = q

    if (countMatching(selectedFilters, q) === 0) {
      // Pas de résultat : on garde la ref mais on ne consomme pas le quota.
      return
    }
    if (searchQuota.limit !== null) {
      const used = searchQuota.counts['_shared'] || 0
      if (used >= searchQuota.limit) {
        showUpgrade('searches-bar')
        return
      }
    }
    try {
      const res = await fetch('/api/track-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterId: 'Recherche',
          query: q,
          filters: selectedFilters,
          source: 'bar',
        }),
      })
      if (res.status === 403) {
        try {
          const data = await res.json()
          if (data?.counts) {
            setSearchQuota((s) => ({ ...s, counts: data.counts, limit: data.limit ?? s.limit }))
          }
        } catch { /* ignore */ }
        showUpgrade('searches-bar')
        return
      }
      if (res.ok) {
        try {
          const data = await res.json()
          if (data?.counts) {
            setSearchQuota({
              counts: data.counts,
              limit: data.limit ?? null,
              tier: data.tier ?? 'discovery',
            })
          }
        } catch { /* ignore */ }
      }
    } catch {
      // Erreur réseau : ref déjà set, on retentera au prochain submit
      // d'une autre query (ou si user efface puis re-entre la même).
    }
  }

  const handleFilterChange = async (filters: Record<string, string[]>) => {
    // Detecter les filtres nouvellement ajoutes pour tracker les quotas de recherche.
    // Un "filtre" au sens quota = une categorie (Pays, Secteur, ...).
    // On incremente une fois par categorie ayant recu une nouvelle valeur.
    const newlyAddedCategories: string[] = []
    for (const [category, values] of Object.entries(filters)) {
      const prev = selectedFilters[category] || []
      const added = values.some((v) => !prev.includes(v))
      if (added) newlyAddedCategories.push(category)
    }

    // Clic tag = soumission implicite : on commit la recherche en cours
    // (le live searchQuery) en même temps que l'on applique le filtre.
    const q = searchQuery.trim()
    setCommittedSearchQuery(q)

    // Regle metier : un filtre qui ne renvoie aucun resultat ne consomme pas
    // de quota (l'utilisateur voit "Aucune campagne trouvee" — ne doit pas
    // bruler son compteur mensuel partage).
    const wouldReturnResults = countMatching(filters, q) > 0

    if (!wouldReturnResults) {
      setSelectedFilters(filters)
      setActiveQuickFilter("")
      setCurrentPage(1)
      return
    }

    // Pre-block local : si la limite est deja atteinte, popup immediate sans hit API.
    if (newlyAddedCategories.length > 0 && searchQuota.limit !== null) {
      const used = searchQuota.counts['_shared'] || 0
      if (used >= searchQuota.limit) {
        showUpgrade('searches-filters')
        return
      }
    }

    for (const category of newlyAddedCategories) {
      try {
        const res = await fetch('/api/track-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterId: category,
            query: q,
            filters: filters,
            source: 'filter',
          }),
        })
        if (res.status === 403) {
          try {
            const data = await res.json()
            if (data?.counts) {
              setSearchQuota((q) => ({ ...q, counts: data.counts, limit: data.limit ?? q.limit }))
            }
          } catch { /* ignore */ }
          showUpgrade('searches-filters')
          return
        }
        if (res.ok) {
          try {
            const data = await res.json()
            if (data?.counts) {
              setSearchQuota({
                counts: data.counts,
                limit: data.limit ?? null,
                tier: data.tier ?? 'discovery',
              })
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Erreur reseau : on laisse passer pour ne pas bloquer l'UX.
      }
    }

    setSelectedFilters(filters)
    setActiveQuickFilter("")
    setCurrentPage(1)
  }

  const weekLabel = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "d MMMM yyyy", { locale: fr })

  // Tant que l'abonnement n'est pas validé (ou en cours de vérif), on n'affiche
  // PAS le contenu du dashboard — sinon il "flashe" avant le redirect vers /subscribe.
  if (subChecking || subLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F2B33D] border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {subLocked ? "On prépare votre accès Laveiye…" : "Chargement de votre espace…"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-background relative">
      <ParticlesBackground color="#F2B33D" particleCount={40} />
      <div className="relative z-10">
        <DashboardNavbar
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q)
            // Si l'utilisateur efface complètement la barre, on commit aussi
            // pour ne pas laisser d'anciens résultats filtrés à l'écran.
            if (q.trim() === '') setCommittedSearchQuery('')
            setCurrentPage(1)
          }}
          onSearchSubmit={handleSubmitSearch}
          userPlan={userPlan}
          monthlyClicks={monthlyClicks}
          monthlyClickLimit={MONTHLY_CLICK_LIMIT}
          isFreeUser={isFreeUser}
          monthlyExplored={monthlyExplored}
          searchSuggestions={searchSuggestions}
          searchQuota={searchQuota}
        />

        <TempsFortsBanner />
        <TempsFortsPopup />

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          {/* Upsell Basic → Pro : utilisateur Basic à fort usage de recherches */}
          {(() => {
            const isBasicTier = userPlan === 'Basic' && searchQuota.limit !== null && searchQuota.limit !== Infinity
            if (!isBasicTier) return null
            const used = searchQuota.counts['_shared'] || 0
            const limit = searchQuota.limit as number
            const pct = limit > 0 ? (used / limit) * 100 : 0
            if (pct < 70) return null
            return (
              <div className="mb-6">
                <BasicToProBanner
                  trigger="searches-heavy"
                  usagePercent={pct}
                  dismissKey="basic-searches-heavy"
                />
              </div>
            )
          })()}

          {/* Banniere contextuelle — suivi de marque active via ?brand= */}
          {brandFilter && (
            <div className="mb-6 rounded-2xl border-2 border-[#F2B33D]/30 bg-gradient-to-r from-[#F2B33D]/10 to-background p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2B33D] shadow-lg shadow-[#F2B33D]/25">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Suivi active : <span className="text-[#F2B33D]">{brandFilter}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredContent.length} campagne{filteredContent.length > 1 ? 's' : ''} correspond{filteredContent.length > 1 ? 'ent' : ''} a votre demande
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background border-[#F2B33D]/40 text-[#F2B33D] hover:bg-[#F2B33D]/5"
                  onClick={clearBrandFilter}
                >
                  Effacer le filtre marque
                </Button>
              </div>
            </div>
          )}

          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="animate-fade-in-up">
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-foreground">
                Bibliothèque
              </h1>
              <p className="mt-2 text-base font-medium text-muted-foreground">
                <span className="text-lg font-bold text-[#F2B33D]">{filteredContent.length}</span> campagne{filteredContent.length > 1 ? "s" : ""} trouvée{filteredContent.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center min-w-0">
              {/* Quick Filters */}
              <div className="-mx-4 flex min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => handleQuickFilter(filter)}
                    className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ${activeQuickFilter === filter.label
                      ? "bg-[#F2B33D] text-white shadow-md shadow-[#F2B33D]/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden bg-background border-border text-foreground"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filtres
                </Button>

                <div className="hidden items-center gap-1 rounded-lg border border-border bg-background p-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`rounded p-1.5 ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded p-1.5 ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label="List view"
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* Desktop Filters */}
            <FiltersSidebar
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
              className="hidden w-64 shrink-0 lg:block"
              dynamicOptions={dynamicFilterOptions}
              isFreeUser={isFreeUser}
              onLockedFilterClick={() => showUpgrade("filters")}
              searchQuota={searchQuota}
            />

            {/* Mobile Filters */}
            {showMobileFilters && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
                <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Filtres</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowMobileFilters(false)}>
                      Fermer
                    </Button>
                  </div>
                  <FiltersSidebar
                    selectedFilters={selectedFilters}
                    onFilterChange={handleFilterChange}
                    dynamicOptions={dynamicFilterOptions}
                    isFreeUser={isFreeUser}
                    onLockedFilterClick={() => { setShowMobileFilters(false); showUpgrade("filters") }}
                    searchQuota={searchQuota}
                  />
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="flex-1 min-w-0">

               {/* Section "Les meilleures campagnes de la semaine" — Swiper */}
          {filteredWeeklyCampaigns.length > 0 && (
            <section className="mb-10 rounded-2xl bg-gradient-to-r from-[#F2B33D]/5 to-background border border-[#F2B33D]/20 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#f59e0b] shadow-lg shadow-[#F2B33D]/25">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
                      Notre sélection hebdomadaire de campagnes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Semaine du {weekLabel}
                    </p>
                  </div>
                </div>
               {/*
               <span className="hidden sm:flex items-center gap-1 rounded-full bg-[#F2B33D]/20 px-3 py-1 text-xs font-semibold text-[#b45309]">
                  <Sparkles className="h-3 w-3" />
                  {filteredWeeklyCampaigns.filter(c => c.featured).length > 0
                    ? `${filteredWeeklyCampaigns.filter(c => c.featured).length} sélection${filteredWeeklyCampaigns.filter(c => c.featured).length > 1 ? 's' : ''} éditeur`
                    : `${filteredWeeklyCampaigns.length} nouvelles`
                  }
                </span>
               */} 
              </div>

              <SwipeableCarousel
                showArrows={true}
                showIndicators={true}
                slidesPerView={{ mobile: 1, tablet: 2, desktop: 3 }}
              >
                {filteredWeeklyCampaigns.slice(0, 9).map((campaign) => (
                  <div key={campaign.id} className="flex flex-1 flex-col px-1">
                    <ContentCard
                      content={campaign}
                      onBeforeNavigate={(c) => handleContentClick(c)}
                    />
                  </div>
                ))}
              </SwipeableCarousel>
            </section>
          )}

          {/* Section "À explorer pour votre suivi de marques" — un sous-bloc par demande
              approuvée+payée, filtrée par marque + pays + secteurs + canaux. */}
          {resolvedBrandMonitoringGroups.length > 0 && (
            <section className="mb-10 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] shadow-lg shadow-[#10B981]/25">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-foreground">
                    À explorer pour votre veille concurrentielle
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    {resolvedBrandMonitoringGroups.length} marque{resolvedBrandMonitoringGroups.length > 1 ? 's' : ''} suivie{resolvedBrandMonitoringGroups.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {resolvedBrandMonitoringGroups.map((group) => {
                const renewalDate = group.nextRenewalAt
                  ? new Date(group.nextRenewalAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : null
                const socialLabels: Record<string, string> = {
                  facebook: 'Facebook',
                  instagram: 'Instagram',
                  linkedin: 'LinkedIn',
                  x: 'X',
                  tiktok: 'TikTok',
                }
                const deepLink = buildBrandMonitoringDeepLink(group)
                return (
                  <div
                    key={`brand-block-${group.requestId}`}
                    className="rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-[#10B981]/5 to-card p-5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] shadow-lg shadow-[#10B981]/25 shrink-0">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground truncate">
                              {group.brandName}
                            </h3>
                            {/* Badge statut style "Suivi de marques" */}
                            {group.autoRenew === false ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                                Résilié
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Approuvée
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {group.contents.length} campagne{group.contents.length > 1 ? 's' : ''}
                            </span>
                            {renewalDate && (
                              <span>
                                {group.autoRenew === false ? 'Suivie jusqu’au' : 'Renouvellement le'}{' '}
                                <strong>{renewalDate}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/rss/brand/${encodeURIComponent(group.brandName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Flux RSS — ${group.brandName}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-card px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                        >
                          <Rss className="h-3 w-3" />
                          RSS
                        </a>
                        <Link
                          href={deepLink}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#059669]"
                        >
                          Voir tout
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="p-5">
                    {/* Chips : pays / secteurs / canaux de la demande */}
                    {(group.countries.length > 0 ||
                      group.sectors.length > 0 ||
                      group.channels.length > 0) && (
                      <div className="mb-4 flex flex-wrap items-center gap-1.5">
                        {group.countries.map((c) => (
                          <span
                            key={`c-${c}`}
                            className="inline-flex items-center rounded-full bg-card border border-[#10B981]/30 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                          >
                            {c}
                          </span>
                        ))}
                        {group.sectors.map((s) => (
                          <span
                            key={`s-${s}`}
                            className="inline-flex items-center rounded-full bg-card border border-[#10B981]/30 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                          >
                            {s}
                          </span>
                        ))}
                        {group.channels.map((ch) => (
                          <span
                            key={`ch-${ch}`}
                            className="inline-flex items-center rounded-full bg-[#10B981]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]"
                          >
                            {socialLabels[ch] || ch}
                          </span>
                        ))}
                      </div>
                    )}

                    <SwipeableCarousel
                      showArrows={true}
                      showIndicators={true}
                      slidesPerView={{ mobile: 1, tablet: 2, desktop: 3 }}
                    >
                      {group.contents.slice(0, 12).map((campaign) => (
                        <div
                          key={`tracked-${group.requestId}-${campaign.id}`}
                          className="flex flex-1 flex-col px-1"
                        >
                          <ContentCard
                            content={campaign}
                            onBeforeNavigate={(c) => handleContentClick(c)}
                          />
                        </div>
                      ))}
                    </SwipeableCarousel>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
              {isLoading ? (
                <ContentGridSkeleton count={6} />
              ) : searchQuery.trim() !== '' && searchQuery.trim() !== committedSearchQuery.trim() ? (
                // Recherche tapée mais non encore soumise : on masque les
                // résultats pour forcer l'utilisateur à appuyer sur Entrée
                // (ou cliquer une suggestion/un tag). Évite que les résultats
                // s'affichent sans que le quota soit débité.
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-[#F2B33D]/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-[#F2B33D]/30 animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-lg">
                      <Image
                        src="/logo.png"
                        alt="Laveiye"
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain animate-pulse"
                        priority
                      />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Appuyez sur <kbd className="rounded border border-[#F2B33D]/40 bg-[#F2B33D]/10 px-2 py-0.5 text-sm font-semibold text-[#a17320]">Entrée</kbd> pour rechercher
                  </h3>
                  <p className="mt-2 max-w-md text-base font-medium text-muted-foreground">
                    Validez votre recherche « <span className="font-semibold text-foreground">{searchQuery.trim()}</span> » ou choisissez une suggestion pour afficher les résultats.
                  </p>
                </div>
              ) : paginatedContent.length > 0 ? (
                <>
                  <div className="space-y-10">
                    {groupedContent.map((group) => (
                      <section key={group.monthYear} className="animate-fade-in-up">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#a855f7] shadow-lg shadow-[#F2B33D]/25">
                            <CalendarDays className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold capitalize text-foreground">
                              {group.monthYear}
                            </h2>
                            <p className="text-sm font-medium text-muted-foreground">
                              {group.campaigns.length} campagne{group.campaigns.length > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="ml-4 flex-1 border-b-2 border-dashed border-border" />
                        </div>

                        <div className={`grid gap-6 ${viewMode === "grid"
                          ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr"
                          : "grid-cols-1"
                          }`}>
                          {group.campaigns.map((content) => (
                            <ContentCard
                              key={content.id}
                              content={content}
                              viewMode={viewMode}
                              onBeforeNavigate={(c) => handleContentClick(c)}
                              isBlocked={isFreeUser && monthlyClicks >= MONTHLY_CLICK_LIMIT}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <PaginationBar
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-6 rounded-2xl bg-muted p-6 shadow-inner">
                    <Filter className="h-12 w-12 text-[#F2B33D]" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Aucune campagne trouvée</h3>
                  <p className="mt-2 max-w-md text-base font-medium text-muted-foreground">
                    Essayez de modifier vos filtres pour voir plus de résultats.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 bg-background border-2 border-[#F2B33D]/30 text-[#F2B33D] font-semibold hover:bg-[#F2B33D]/5 hover:border-[#F2B33D]"
                    onClick={() => setSelectedFilters({})}
                  >
                    Effacer les filtres
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Popup */}
      <UpgradePopup
        open={upgradeOpen}
        onClose={closeUpgrade}
        reason={upgradeReason}
      />

    </div>
  )
}
