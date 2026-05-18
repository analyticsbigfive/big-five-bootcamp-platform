"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Menu, X, Search, User, LogOut, Settings, CreditCard, Crown, Sparkles, Clock, Users, Heart, MousePointer, Building2, FolderOpen, SlidersHorizontal, ArrowRight, LibraryBig, Flame, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useAuthContext } from "@/components/auth-provider"
import { getQuotaUpsell, quotaBadgeClass, quotaProgressFillClass, levelFromUsage } from "@/lib/upsell"
import { resolveTier, UNLIMITED } from "@/lib/quotas"
import { getPlanDisplayName } from "@/lib/pricing"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardNavbar({
  searchQuery: externalSearchQuery,
  onSearchChange,
  onSearchSubmit,
  userPlan: externalUserPlan,
  monthlyClicks: externalMonthlyClicks,
  monthlyClickLimit,
  isFreeUser: externalIsFreeUser,
  monthlyExplored: externalMonthlyExplored,
  searchSuggestions,
  searchQuota: externalSearchQuota,
}: {
  searchQuery?: string;
  onSearchChange?: (query: string) => void
  /** Appelé sur soumission explicite (Enter ou clic sur suggestion). Sert au comptage du quota. */
  onSearchSubmit?: (query: string) => void
  userPlan?: string
  monthlyClicks?: number
  monthlyClickLimit?: number
  isFreeUser?: boolean
  monthlyExplored?: number
  searchSuggestions?: string[]
  searchQuota?: {
    counts: Record<string, number>
    limit: number | null
    tier: 'discovery' | 'basic' | 'pro'
  } | null
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const isOnDashboard = pathname === '/dashboard'
  const [isOpen, setIsOpen] = useState(false)
  const [internalSearchQuery, setInternalSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isUserMenuMounted, setIsUserMenuMounted] = useState(false)

  // Lire tout depuis le contexte centralisé — AUCUN appel getUser() ni requête DB
  const {
    user,
    userProfile,
    loading: authLoading,
    userPlan: contextUserPlan,
    isFreeUser: contextIsFreeUser,
    isPremium: contextIsPremium,
    monthlyClicks: contextMonthlyClicks,
    monthlyExplored: contextMonthlyExplored,
    signOut,
  } = useAuthContext()

  // Le profil est considéré "prêt" quand l'auth est résolue ET qu'on a reçu
  // les données DB (ou que l'utilisateur n'est pas connecté).
  // Tant que ce n'est pas le cas, on n'affiche AUCUN badge plan/quota —
  // ça évite le flash "Pro" puis "Free" (et inversement).
  const profileReady = !authLoading && (!user || userProfile !== null)

  const userName = userProfile?.name || ""
  const userEmail = user?.email || ""
  const subscriptionEndDate = userProfile?.subscription_end_date || null
  const subscriptionStatus = userProfile?.subscription_status || null
  
  // Utiliser la recherche externe si fournie, sinon interne
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const setSearchQuery = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
  }

  // Use external props if provided, otherwise use context data
  const effectivePlan = externalUserPlan || contextUserPlan
  const isPremium = externalUserPlan
    ? ["basic", "pro"].includes(externalUserPlan.toLowerCase())
    : contextIsPremium
  const effectiveIsFreeUser = externalIsFreeUser !== undefined ? externalIsFreeUser : contextIsFreeUser
  const effectiveMonthlyClicks = externalMonthlyClicks !== undefined ? externalMonthlyClicks : contextMonthlyClicks
  const effectiveMonthlyExplored = externalMonthlyExplored !== undefined ? externalMonthlyExplored : contextMonthlyExplored
  const initials = userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"
  const avatarUrl = (userProfile as any)?.avatar_url || user?.user_metadata?.avatar_url || ""

  useEffect(() => {
    setIsUserMenuMounted(true)
  }, [])

  // Couleur du badge plan : Découverte = bleu, Basic = vert, Pro = gold.
  const planKeyLower = (effectivePlan || "").toLowerCase()
  const planDropdownBadgeClass =
    planKeyLower === "pro"
      ? "border-[#F2B33D] bg-[#F2B33D]/10 text-[#a17320]"
      : planKeyLower === "basic"
        ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]"
        : "border-[#2364d7] bg-[#2364d7]/10 text-[#2364d7]"

  // Calcul de la durée restante de l'abonnement
  const getSubscriptionInfo = () => {
    if (!isPremium || !subscriptionEndDate) {
      return { active: false, daysLeft: 0, label: "", expiringSoon: false, expired: false }
    }
    
    const endDate = new Date(subscriptionEndDate)
    const now = new Date()
    const diffMs = endDate.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    if (daysLeft <= 0) {
      return { active: false, daysLeft: 0, label: "Expiré", expiringSoon: false, expired: true }
    }
    if (daysLeft <= 7) {
      return { active: true, daysLeft, label: `${daysLeft}j`, expiringSoon: true, expired: false }
    }
    return { active: true, daysLeft, label: `${daysLeft}j`, expiringSoon: false, expired: false }
  }

  const subInfo = getSubscriptionInfo()

  // Si une page parente nous fournit le quota (le dashboard, en temps réel), on l'utilise.
  // Sinon (ex: page de détail), on fetche nous-mêmes toutes les 15s.
  const [internalSearchQuota, setInternalSearchQuota] = useState<{
    counts: Record<string, number>
    limit: number | null
    tier: 'discovery' | 'basic' | 'pro'
  } | null>(null)
  const searchQuota = externalSearchQuota !== undefined ? externalSearchQuota : internalSearchQuota

  useEffect(() => {
    if (externalSearchQuota !== undefined) return
    if (!profileReady || !user) return
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/track-search')
        if (!r.ok || cancelled) return
        const data = await r.json()
        setInternalSearchQuota({
          counts: data.counts || {},
          limit: data.limit ?? null,
          tier: data.tier ?? 'discovery',
        })
      } catch { /* silencieux */ }
    }
    load()
    // Polling régulier pour les pages qui ne nous fournissent pas le quota en temps réel.
    const id = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [profileReady, user, externalSearchQuota])

  // Compteur partage recherches+filtres (cle _shared dans le JSONB mensuel).
  const sharedSearchUsed = searchQuota?.counts['_shared'] ?? 0
  const searchLimit = searchQuota?.limit ?? null
  const showQuotaBadges = profileReady && !!user && searchLimit !== null
  const sharedSearchReached = showQuotaBadges && sharedSearchUsed >= (searchLimit as number)
  // Legacy aliases (utilises dans les pills ci-dessous)
  const searchBarUsed = sharedSearchUsed
  const searchBarReached = sharedSearchReached
  const filtersPeak = sharedSearchUsed
  const filtersReached = sharedSearchReached

  // —— Upsell progressif (paliers 70/90/100%) ——
  // Résout le tier effectif pour adapter le message (Free → Basic, Basic → Pro).
  const upsellTier = resolveTier(effectivePlan, subscriptionStatus)
  const clickLimitForUpsell = monthlyClickLimit || 10
  const clicksUpsell = (effectiveIsFreeUser && profileReady)
    ? getQuotaUpsell(effectiveMonthlyClicks, clickLimitForUpsell, upsellTier, "clicks")
    : null
  const searchUpsell = (showQuotaBadges && searchLimit !== null && searchLimit !== UNLIMITED)
    ? getQuotaUpsell(sharedSearchUsed, searchLimit as number, upsellTier, "searches")
    : null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F5F5F5] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 max-h-[65px] overflow-hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/niggaz/normalGlogo.png"
              alt="Laveiye"
              width={189}
              height={40}
              className="dark:hidden"
              priority
            />
            <Image
              src="/niggaz/white.webp"
              alt="Laveiye"
              width={189}
              height={40}
              className="hidden h-10 w-auto dark:block"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#F5F5F5]/50 flex items-center gap-1"
            >
              <LibraryBig className="h-3.5 w-3.5" aria-hidden="true" />
              Bibliothèque
            </Link>
            <Link
              href="/temps-forts"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Temps forts
            </Link>
            {isPremium && (
              <Link
                href="/favorites"
                className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1"
              >
                <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                Favoris
              </Link>
            )}
            {isPremium && (
              <Link
                href="/favorites?tab=collections"
                className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1"
              >
                <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Collections
              </Link>
            )}
            <Link
              href="/dashboard/brand-requests"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Veille
            </Link>
          </nav>
        </div>

        <div className="hidden flex-1 items-center justify-center px-8 md:flex">
          <div className="relative w-full max-w-xl group">
            {/* Glow gradient de fond */}
            <div className="absolute -inset-1.5 bg-[#F2B33D]/30 rounded-2xl blur-lg opacity-60 group-focus-within:opacity-100 group-hover:opacity-80 transition-opacity duration-300" />
            <form
              className="relative flex items-center"
              onSubmit={(e) => {
                e.preventDefault()
                const q = searchQuery.trim()
                if (!q) return
                if (!isOnDashboard) {
                  router.push(`/dashboard?search=${encodeURIComponent(q)}`)
                } else if (onSearchSubmit) {
                  // Sur dashboard : déclencher le décompte du quota uniquement
                  // sur soumission explicite (Enter). Pas de comptage à la volée.
                  onSearchSubmit(q)
                }
                setShowSuggestions(false)
              }}
            >
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-[#F2B33D] group-focus-within:bg-[#F2B33D] transition-colors">
                <Search className="h-4 w-4 text-white" />
              </div>
              <input
                type="text"
                placeholder="Rechercher par mots-clés, marque, secteur, pays..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="h-13 w-full rounded-2xl border-2 border-[#F2B33D]/40 bg-gradient-to-r from-[#F5F5F5]/40 to-white pl-14 pr-4 text-sm font-semibold text-[#0F0F0F] shadow-lg shadow-[#F2B33D]/15 outline-none transition-all placeholder:text-[#0F0F0F]/45 placeholder:font-medium focus:border-[#F2B33D] focus:ring-4 focus:ring-[#F2B33D]/20 focus:shadow-xl focus:shadow-[#F2B33D]/20 focus:bg-white hover:border-[#F2B33D]/60 hover:shadow-xl hover:shadow-[#F2B33D]/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#0F0F0F]/50 hover:text-white hover:bg-[#F2B33D] transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            {/* Suggestions d'autocompl\u00e9tion */}
            {showSuggestions && searchQuery.trim().length >= 1 && (() => {
              const q = searchQuery.trim().toLowerCase()
              const all = searchSuggestions || []
              const seen = new Set<string>()
              const filtered: string[] = []
              for (const s of all) {
                if (!s) continue
                const key = s.toLowerCase()
                if (key === q) continue
                if (!key.includes(q)) continue
                if (seen.has(key)) continue
                seen.add(key)
                filtered.push(s)
                if (filtered.length >= 8) break
              }
              if (filtered.length === 0) return null
              return (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border-2 border-[#F2B33D]/30 bg-white shadow-2xl overflow-hidden">
                  <ul className="py-1 max-h-72 overflow-y-auto">
                    {filtered.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            if (isOnDashboard) {
                              setSearchQuery(s)
                              // Clic sur suggestion = soumission explicite → décompte.
                              onSearchSubmit?.(s)
                            } else {
                              router.push(`/dashboard?search=${encodeURIComponent(s)}`)
                            }
                            setShowSuggestions(false)
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#0F0F0F] hover:bg-[#F2B33D]/10"
                        >
                          <Search className="h-3.5 w-3.5 text-[#F2B33D]" />
                          <span className="truncate">{s}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Skeleton tant que le profil n'est pas chargé — évite le flash de plan */}
          {!profileReady && user && (
            <div className="hidden md:flex items-center gap-2" aria-hidden>
              <div className="h-8 w-32 rounded-full bg-[#F5F5F5] animate-pulse" />
              <div className="h-8 w-24 rounded-full bg-[#F5F5F5] animate-pulse" />
            </div>
          )}

          {/* Compteur mensuel de consultations (Découverte) — upsell progressif 70/90/100% */}
          {profileReady && effectiveIsFreeUser && (() => {
            const clickLimit = clickLimitForUpsell
            const upsell = clicksUpsell
            const colorClass = upsell
              ? quotaBadgeClass(upsell.level)
              : "bg-[#F5F5F5] text-[#0F0F0F]"
            const title = upsell
              ? upsell.fullMessage
              : `${effectiveMonthlyClicks}/${clickLimit} campagnes consultables ce mois`
            const isClickable = !!upsell && upsell.ctaPlan !== null
            const Wrapper: any = isClickable ? Link : "div"
            const wrapperProps = isClickable ? { href: upsell!.ctaHref } : {}
            // Barre de progression : niveau & pourcentage (fallback "safe" si pas d'upsell)
            const level = upsell?.level ?? levelFromUsage(effectiveMonthlyClicks, clickLimit)
            const pct = Math.min(100, Math.max(0, (effectiveMonthlyClicks / Math.max(1, clickLimit)) * 100))
            const fillClass = quotaProgressFillClass(level)
            return (
              <Wrapper
                {...wrapperProps}
                className={`relative hidden md:flex items-center gap-1.5 rounded-full pl-3 pr-3 pt-1 pb-2 text-xs font-semibold overflow-hidden transition-all ${colorClass} ${isClickable ? "cursor-pointer hover:scale-105 hover:shadow-sm" : ""}`}
                title={title}
              >
                <MousePointer className="h-3.5 w-3.5" />
                <span>{effectiveMonthlyClicks}/{clickLimit} ce mois</span>
                {upsell && upsell.level !== "safe" && (
                  <ArrowRight className="h-3 w-3 opacity-70" />
                )}
                {/* Barre de progression intégrée */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-1 bg-black/5 w-full"
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-0 left-0 h-1 ${fillClass} transition-[width] duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </Wrapper>
            )
          })()}
          {/* Compteur d'usage mensuel (Pro/Basic payant) */}
          {profileReady && !effectiveIsFreeUser && isPremium && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full px-3 h-8 bg-[#10B981]/10 text-[#10B981] text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              {effectiveMonthlyExplored} explorée{effectiveMonthlyExplored > 1 ? 's' : ''} ce mois
            </div>
          )}

          {/* Quota mensuel partage recherches+filtres — upsell progressif 70/90/100% (caché pour Pro) */}
          {showQuotaBadges && (() => {
            const upsell = searchUpsell
            const colorClass = upsell
              ? quotaBadgeClass(upsell.level)
              : sharedSearchReached
                ? "bg-red-100 text-red-700"
                : "bg-[#F2B33D]/10 text-[#0F0F0F]"
            const title = upsell
              ? upsell.fullMessage
              : sharedSearchReached
                ? `Limite atteinte : ${sharedSearchUsed}/${searchLimit} recherches ou filtres ce mois`
                : `${sharedSearchUsed}/${searchLimit} recherches ou filtres ce mois`
            const isClickable = !!upsell && upsell.ctaPlan !== null
            const Wrapper: any = isClickable ? Link : "div"
            const wrapperProps = isClickable ? { href: upsell!.ctaHref } : {}
            const limitNum = (searchLimit as number) || 0
            const level = upsell?.level ?? levelFromUsage(sharedSearchUsed, limitNum)
            const pct = limitNum > 0 ? Math.min(100, Math.max(0, (sharedSearchUsed / limitNum) * 100)) : 0
            const fillClass = quotaProgressFillClass(level)
            return (
              <Wrapper
                {...wrapperProps}
                className={`relative hidden md:flex items-center gap-1.5 rounded-full pl-3 pr-3 pt-1 pb-2 text-xs font-semibold overflow-hidden transition-all ${colorClass} ${isClickable ? "cursor-pointer hover:scale-105 hover:shadow-sm" : ""}`}
                title={title}
              >
                <Search className="h-3.5 w-3.5" />
                <span>{sharedSearchUsed}/{searchLimit} rech. ou filtres</span>
                {upsell && upsell.level !== "safe" && (
                  <ArrowRight className="h-3 w-3 opacity-70" />
                )}
                {/* Barre de progression intégrée */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-1 bg-black/5 w-full"
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-0 left-0 h-1 ${fillClass} transition-[width] duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </Wrapper>
            )
          })()}
          {/* Bouton d'abonnement : durée restante ou incitatif */}
          {profileReady && isPremium && subInfo.active && !subInfo.expiringSoon ? (
            /* Plan payant actif, pas d'expiration proche → badge plan (Basic = upsell vers Pro, Pro = pas d'upsell) */
            (() => {
              const isPro = planKeyLower === "pro"
              const planLabel = isPro ? "Pro" : "Basic"
              const pillClass =
                "group/planpill relative hidden md:inline-flex items-center gap-1.5 rounded-full px-3 h-8 bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 text-xs font-bold shadow-sm transition-all"
              if (isPro) {
                return (
                  <div
                    className={pillClass}
                    title="Vous êtes au plan maximum"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    {planLabel} · {subInfo.label}
                  </div>
                )
              }
              return (
                <Link
                  href="/subscribe?plan=pro"
                  className={`${pillClass} cursor-pointer hover:scale-105 hover:shadow-md`}
                  title="Passer en Pro ↑"
                  aria-label="Plan Basic actif. Passer en Pro"
                >
                  <Crown className="h-3.5 w-3.5 transition-opacity group-hover/planpill:opacity-0" />
                  <span className="transition-opacity group-hover/planpill:opacity-0">
                    {planLabel} · {subInfo.label}
                  </span>
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity group-hover/planpill:opacity-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Passer Pro
                  </span>
                </Link>
              )
            })()
          ) : profileReady && isPremium && subInfo.active && subInfo.expiringSoon ? (
            /* Premium actif mais expire dans ≤ 7 jours → bouton "Renouveler" sur le plan courant */
            <Link href={`/subscribe?plan=${planKeyLower === "pro" ? "pro" : "basic"}`} className="hidden md:flex">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs font-semibold rounded-full px-3 h-8 bg-amber-100 text-amber-800 hover:bg-amber-200 animate-pulse"
              >
                <Clock className="h-3.5 w-3.5" />
                Renouveler · {subInfo.label}
              </Button>
            </Link>
          ) : profileReady && isPremium && subInfo.expired ? (
            /* Abonnement expiré → bouton rouge "Renouveler" sur le plan courant */
            <Link href={`/subscribe?plan=${planKeyLower === "pro" ? "pro" : "basic"}`} className="hidden md:flex">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs font-semibold rounded-full px-3 h-8 bg-red-100 text-red-800 hover:bg-red-200"
              >
                <Clock className="h-3.5 w-3.5" />
                Renouveler
              </Button>
            </Link>
          ) : profileReady ? (
            /* Plan Découverte (Free) → badge "Découverte" cliquable avec upsell vers Basic */
            <Link
              href="/subscribe?plan=basic"
              className="group/planpill relative hidden md:inline-flex items-center gap-1.5 rounded-full px-3 h-8 bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-105 hover:shadow-md"
              title="Passer en Basic ↑"
              aria-label="Plan Découverte actif. Passer en Basic"
            >
              <Sparkles className="h-3.5 w-3.5 transition-opacity group-hover/planpill:opacity-0" />
              <span className="transition-opacity group-hover/planpill:opacity-0">
                Découverte
              </span>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity group-hover/planpill:opacity-100">
                <Sparkles className="h-3.5 w-3.5" />
                Passer Basic
              </span>
            </Link>
          ) : null}

          {isUserMenuMounted ? (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={userName || "avatar"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/icons/default-avatar.svg"
                    alt={userName || "avatar"}
                    className="h-8 w-8 rounded-full bg-[#F5F5F5]"
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-[#F5F5F5]">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-[#0F0F0F]">{userName || "Utilisateur"}</p>
                <p className="text-xs text-[#0F0F0F]/60">{userEmail}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium border transition-all ${planDropdownBadgeClass}`}>
                    {getPlanDisplayName(effectivePlan)}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 text-[#0F0F0F]">
                  <User className="h-4 w-4" aria-hidden="true" />
                  Profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/subscribe" className="flex items-center gap-2 text-[#0F0F0F]">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Abonnement
                </Link>
              </DropdownMenuItem>
              {isPremium && (
                <DropdownMenuItem asChild>
                  <Link href="/favorites" className="flex items-center gap-2 text-[#0F0F0F]">
                    <Heart className="h-4 w-4" aria-hidden="true" />
                    Mes Favoris
                  </Link>
                </DropdownMenuItem>
              )}
              {isPremium && (
                <DropdownMenuItem asChild>
                  <Link href="/favorites?tab=collections" className="flex items-center gap-2 text-[#0F0F0F]">
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    Collections
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/dashboard/brand-requests" className="flex items-center gap-2 text-[#0F0F0F]">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Veille concurrentielle
                </Link>
              </DropdownMenuItem>
              {planKeyLower === "pro" && (
                <DropdownMenuItem asChild>
                  <Link href="/decrypte" className="flex items-center gap-2 text-[#0F0F0F]">
                    <Crown className="h-4 w-4 text-[#F2B33D]" />
                    #BigFiveDécrypte
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 text-[#0F0F0F]">
                  <Settings className="h-4 w-4" />
                  Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut()
                  window.location.href = "/"
                }}
                className="flex items-center gap-2 text-red-600 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-none rounded-full"
              type="button"
              aria-hidden="true"
              tabIndex={-1}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/icons/default-avatar.svg"
                  alt=""
                  className="h-8 w-8 rounded-full bg-[#F5F5F5]"
                />
              )}
            </Button>
          )}

          <button
            type="button"
            className="md:hidden text-[#0F0F0F]"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-[#F5F5F5] bg-white md:hidden">
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0F0F0F]/50" />
              <input
                type="text"
                placeholder="Rechercher des campagnes..."
                className="h-10 w-full rounded-lg border border-[#F5F5F5] bg-white pl-10 pr-4 text-sm text-[#0F0F0F] outline-none"
              />
            </div>
          </div>
          <nav className="flex flex-col gap-1 px-4 pb-4">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F] transition-colors hover:bg-[#F5F5F5]/50 flex items-center gap-1.5"
              onClick={() => setIsOpen(false)}
            >
              <LibraryBig className="h-4 w-4" aria-hidden="true" />
              Bibliothèque
            </Link>
            <Link
              href="/temps-forts"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1.5"
              onClick={() => setIsOpen(false)}
            >
              <Flame className="h-4 w-4" aria-hidden="true" />
              Temps forts
            </Link>
            {isPremium && (
              <Link
                href="/favorites"
                className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1.5"
                onClick={() => setIsOpen(false)}
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                Mes Favoris
              </Link>
            )}
            {isPremium && (
              <Link
                href="/favorites?tab=collections"
                className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] flex items-center gap-1.5"
                onClick={() => setIsOpen(false)}
              >
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                Collections
              </Link>
            )}
            {/* Bouton abonnement mobile */}
            <Link
              href={isPremium ? "/subscribe" : "/pricing"}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isPremium && subInfo.active && !subInfo.expiringSoon
                  ? "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800"
                  : isPremium && subInfo.active && subInfo.expiringSoon
                    ? "bg-amber-50 text-amber-800"
                    : isPremium && subInfo.expired
                      ? "bg-red-50 text-red-800"
                      : "bg-[#F2B33D]/10 text-[#F2B33D] font-semibold"
              }`}
              onClick={() => setIsOpen(false)}
            >
              {isPremium && subInfo.active && !subInfo.expiringSoon ? (
                <span className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  {getPlanDisplayName(effectivePlan)} · {subInfo.label}
                </span>
              ) : isPremium && subInfo.active && subInfo.expiringSoon ? (
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Renouveler · {subInfo.label}
                </span>
              ) : isPremium && subInfo.expired ? (
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Abonnement expiré — Renouveler
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Tarifs
                </span>
              )}
            </Link>
            <Link
              href="/settings"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-colors hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F]"
              onClick={() => setIsOpen(false)}
            >
              Paramètres
            </Link>
            <div className="border-t border-[#F5F5F5] mt-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false)
                  await signOut()
                  window.location.href = "/"
                }}
                className="w-full rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
