"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { TempsFortsBanner } from "@/components/temps-forts/temps-forts-banner"
import { TempsFortsPopup } from "@/components/temps-forts/temps-forts-popup"
import type { DynamicFilterOptions } from "@/components/dashboard/filters-sidebar"
import { ContentCard, ContentItem } from "@/components/dashboard/content-card"
import { ContentGridSkeleton } from "@/components/dashboard/content-card-skeleton"
import { UpgradePopup, useUpgradePopup } from "@/components/upgrade-popup"
import { createClient } from "@/lib/supabase"
import { useAuthContext } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Filter, Grid3X3, LayoutList, ChevronLeft, ChevronRight, CalendarDays, TrendingUp, ChevronRight as ArrowRight, Sparkles } from "lucide-react"
import { format, parseISO, startOfWeek, subDays } from "date-fns"
import { fr } from "date-fns/locale"
import { isPaidPlan, canAccessPremiumContent } from "@/lib/pricing"
import { fixBrokenEncoding } from "@/lib/utils"

const ParticlesBackground = dynamic(() => import("@/components/ui/particles-background").then(m => m.ParticlesBackground), { ssr: false })
const FiltersSidebar = dynamic(() => import("@/components/dashboard/filters-sidebar").then(m => m.FiltersSidebar))
const SwipeableCarousel = dynamic(() => import("@/components/ui/swipeable-carousel").then(m => m.SwipeableCarousel), { ssr: false })

// Compteur mensuel de clics (côté serveur via API)
const MONTHLY_CLICK_LIMIT = 3

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

function PaginationPageButton({ page, isActive, onClick }: { page: number; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 w-10 rounded-lg text-sm font-bold transition-all duration-200 ${isActive
        ? "bg-[#F2B33D] text-white shadow-lg shadow-[#F2B33D]/30 scale-110"
        : "bg-white border-2 border-[#F5F5F5] text-[#0F0F0F]/70 hover:bg-[#F5F5F5] hover:text-[#0F0F0F] hover:border-[#F2B33D]/30"
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
        className="h-10 w-10 border-2 border-[#F5F5F5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#F2B33D]/30"
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
                  className="h-10 w-14 rounded-lg border-2 border-[#F2B33D]/40 bg-white text-center text-sm font-bold text-[#0F0F0F] outline-none focus:border-[#F2B33D] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                className="h-10 min-w-10 rounded-lg border-2 border-dashed border-[#F5F5F5] bg-white px-2 text-sm font-bold text-[#0F0F0F]/50 transition-all hover:border-[#F2B33D]/40 hover:text-[#F2B33D]"
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
        className="h-10 w-10 border-2 border-[#F5F5F5] bg-white p-0 hover:bg-[#F5F5F5] hover:border-[#F2B33D]/30"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const brandFilter = searchParams.get("brand") ?? ""
  const tempsFortFilter = searchParams.get("temps_fort") ?? ""

  const [campaigns, setCampaigns] = useState<ContentItem[]>([])
  const [weeklyCampaigns, setWeeklyCampaigns] = useState<ContentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({})
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [activeQuickFilter, setActiveQuickFilter] = useState("Tous")
  // Pré-remplir la recherche depuis ?brand=X (lien direct depuis notification/email)
  const [searchQuery, setSearchQuery] = useState(() => brandFilter)
  const itemsPerPage = 9

  useEffect(() => {
    setSearchQuery(brandFilter)
    setCurrentPage(1)
  }, [brandFilter])

  const clearBrandFilter = useCallback(() => {
    setSearchQuery("")
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

  const supabase = createClient()

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

  // Charger les campagnes publiees depuis Supabase
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('status', 'Publié')
          .order('created_at', { ascending: false })

        if (error) {
          console.warn('Table campaigns non disponible:', error.message)
          setCampaigns(getSampleCampaigns())
          return
        }

        if (!data || data.length === 0) {
          setCampaigns(getSampleCampaigns())
          return
        }

        const formattedCampaigns: ContentItem[] = (data || []).map((campaign: any) => ({
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
        }))

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

  const filteredContent = useMemo(() => {
    const brandNeedle = brandFilter.trim().toLowerCase()
    return campaigns.filter((content) => {
      // Filtre prioritaire par temps fort (?temps_fort=slug)
      if (tempsFortFilter) {
        if (!content.tempsFortSlugs?.includes(tempsFortFilter)) return false
      }

      // Filtre prioritaire par marque (lorsque ?brand= est present)
      if (brandNeedle) {
        const brandMatch =
          (content.brand || '').toLowerCase().includes(brandNeedle) ||
          content.title.toLowerCase().includes(brandNeedle) ||
          content.tags?.some(t => t.toLowerCase().includes(brandNeedle))
        if (!brandMatch) return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          content.title.toLowerCase().includes(query) ||
          content.description?.toLowerCase().includes(query) ||
          content.brand?.toLowerCase().includes(query) ||
          content.agency?.toLowerCase().includes(query) ||
          content.sector?.toLowerCase().includes(query) ||
          content.platform?.toLowerCase().includes(query) ||
          content.country?.toLowerCase().includes(query) ||
          content.tags?.some(tag => tag.toLowerCase().includes(query)) ||
          content.axe?.some(a => a.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      const countryFilter = selectedFilters["Pays"] || []
      const sectorFilter = selectedFilters["Secteur"] || []
      const formatFilter = selectedFilters["Format"] || []
      const platformFilter = selectedFilters["Plateforme"] || []
      const tagsFilter = selectedFilters["Tags"] || []
      const axeFilter = selectedFilters["Axe créatif"] || []
      const yearFilter = selectedFilters["Année"] || []

      if (countryFilter.length > 0 && !countryFilter.includes(normalizeCountry(content.country))) return false
      if (sectorFilter.length > 0 && !sectorFilter.includes(content.sector)) return false
      if (formatFilter.length > 0 && !formatFilter.includes(content.format)) return false
      if (platformFilter.length > 0 && !platformFilter.includes(content.platform)) return false
      if (tagsFilter.length > 0 && !content.tags.some(tag => tagsFilter.includes(tag))) return false
      if (axeFilter.length > 0 && (!content.axe || !content.axe.some(a => axeFilter.includes(a)))) return false
      if (yearFilter.length > 0 && content.year && !yearFilter.includes(String(content.year))) return false

      return true
    })
  }, [selectedFilters, campaigns, searchQuery, brandFilter, tempsFortFilter])

  // Appliquer les mêmes filtres aux campagnes de la semaine
  const filteredWeeklyCampaigns = useMemo(() => {
    const filteredIds = new Set(filteredContent.map(c => c.id))
    return weeklyCampaigns.filter(c => filteredIds.has(c.id))
  }, [weeklyCampaigns, filteredContent])

  const handleContentClick = useCallback(async (_content: ContentItem): Promise<boolean> => {
    // Gate Premium : les campagnes "premium" sont réservées aux abonnés Pro.
    // Les comptes Free et Basic doivent passer au Pro pour y accéder.
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

    for (const category of newlyAddedCategories) {
      try {
        const res = await fetch('/api/track-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filterId: category }),
        })
        if (res.status === 403) {
          showUpgrade('searches')
          return
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-white to-[#F5F5F5]/20 relative">
      <ParticlesBackground color="#F2B33D" particleCount={40} />
      <div className="relative z-10">
        <DashboardNavbar
          searchQuery={searchQuery}
          onSearchChange={(q) => { setSearchQuery(q); setCurrentPage(1) }}
          userPlan={userPlan}
          monthlyClicks={monthlyClicks}
          monthlyClickLimit={MONTHLY_CLICK_LIMIT}
          isFreeUser={isFreeUser}
          monthlyExplored={monthlyExplored}
        />

        <TempsFortsBanner />
        <TempsFortsPopup />

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          {/* Banniere contextuelle — suivi de marque active via ?brand= */}
          {brandFilter && (
            <div className="mb-6 rounded-2xl border-2 border-[#F2B33D]/30 bg-gradient-to-r from-[#F2B33D]/10 to-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2B33D] shadow-lg shadow-[#F2B33D]/25">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F0F0F]">
                      Suivi active : <span className="text-[#F2B33D]">{brandFilter}</span>
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">
                      {filteredContent.length} campagne{filteredContent.length > 1 ? 's' : ''} correspond{filteredContent.length > 1 ? 'ent' : ''} a votre demande
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-[#F2B33D]/40 text-[#F2B33D] hover:bg-[#F2B33D]/5"
                  onClick={clearBrandFilter}
                >
                  Effacer le filtre marque
                </Button>
              </div>
            </div>
          )}

          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="animate-fade-in-up">
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight text-[#0F0F0F]">
                Bibliothèque
              </h1>
              <p className="mt-2 text-base font-medium text-[#0F0F0F]/70">
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
                      : "bg-[#F5F5F5] text-[#0F0F0F]/70 hover:bg-[#F5F5F5]/80 hover:text-[#0F0F0F]"
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
                  className="lg:hidden bg-white border-[#F5F5F5] text-[#0F0F0F]"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filtres
                </Button>

                <div className="hidden items-center gap-1 rounded-lg border border-[#F5F5F5] bg-white p-1 sm:flex">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`rounded p-1.5 ${viewMode === "grid" ? "bg-[#F5F5F5] text-[#0F0F0F]" : "text-[#0F0F0F]/60 hover:text-[#0F0F0F]"}`}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded p-1.5 ${viewMode === "list" ? "bg-[#F5F5F5] text-[#0F0F0F]" : "text-[#0F0F0F]/60 hover:text-[#0F0F0F]"}`}
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
                  />
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="flex-1 min-w-0">

               {/* Section "Les meilleures campagnes de la semaine" — Swiper */}
          {filteredWeeklyCampaigns.length > 0 && (
            <section className="mb-10 rounded-2xl bg-gradient-to-r from-[#F2B33D]/5 to-white border border-[#F2B33D]/20 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#f59e0b] shadow-lg shadow-[#F2B33D]/25">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#0F0F0F]">
                      Notre sélection hebdomadaire de campagnes
                    </h2>
                    <p className="text-sm text-[#0F0F0F]/60">
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
              {isLoading ? (
                <ContentGridSkeleton count={6} />
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
                            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold capitalize text-[#0F0F0F]">
                              {group.monthYear}
                            </h2>
                            <p className="text-sm font-medium text-[#0F0F0F]/60">
                              {group.campaigns.length} campagne{group.campaigns.length > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="ml-4 flex-1 border-b-2 border-dashed border-[#F5F5F5]" />
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
                  <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#F5F5F5] to-[#F5F5F5]/50 p-6 shadow-inner">
                    <Filter className="h-12 w-12 text-[#F2B33D]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0F0F0F]">Aucune campagne trouvée</h3>
                  <p className="mt-2 max-w-md text-base font-medium text-[#0F0F0F]/60">
                    Essayez de modifier vos filtres pour voir plus de résultats.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 bg-white border-2 border-[#F2B33D]/30 text-[#F2B33D] font-semibold hover:bg-[#F2B33D]/5 hover:border-[#F2B33D]"
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
