"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Lock, Sparkles, Loader2, Calendar, Star, Zap, Phone, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { LegalModal } from "@/components/legal-modal"
import { getOperatorLogo } from "@/lib/operator-logos"
import {
  PAWAPAY_COUNTRIES,
  PAWAPAY_PROVIDERS,
  type PawaPayCountryCode,
} from "@/lib/pawapay-providers"

type PlanChoice = "basic" | "pro" | "discovery"

/** Configuration par pays : indicatif, longueur locale attendue, masque d'affichage. */
type CountryCode = PawaPayCountryCode

const COUNTRIES = PAWAPAY_COUNTRIES

/** Formate des chiffres bruts selon un masque (groupes séparés par espaces). */
function formatPhoneMask(digits: string, mask: number[]): string {
  const clean = digits.replace(/\D/g, '')
  const parts: string[] = []
  let cursor = 0
  for (const groupSize of mask) {
    if (cursor >= clean.length) break
    parts.push(clean.slice(cursor, cursor + groupSize))
    cursor += groupSize
  }
  return parts.join(' ')
}

const PLANS = {
  discovery: {
    name: "Découverte",
    price: 1000,
    priceFormatted: "1 000",
    annualPrice: "12 000",
    dailyCost: "~33",
    description: "Pour explorer la plateforme",
    color: "#0F0F0F",
    features: [
      "Accès limité à la bibliothèque",
      "10 campagnes consultables / mois",
      "5 recherches ou filtres / mois",
      "Alertes email hebdo",
    ],
  },
  basic: {
    name: "Basic",
    price: 4900,
    priceFormatted: "4 900",
    annualPrice: "49 000",
    dailyCost: "~163",
    description: "Pour les indépendants",
    color: "#0F0F0F",
    features: [
      "Accès illimité à toute la bibliothèque",
      "Filtres avancés (Secteur, Pays, Format...)",
      "Collections personnalisées",
      "Téléchargement des visuels",
      "30 recherches ou filtres / mois",
    ],
  },
  pro: {
    name: "Pro",
    price: 9900,
    priceFormatted: "9 900",
    annualPrice: "99 000",
    dailyCost: "~330",
    description: "Pour les créatifs exigeants",
    color: "#F2B33D",
    features: [
      "Tout du plan Basic",
      "Recherches ou filtres illimités",
      "Sessions expert #BigFiveDécrypte",
      "Support prioritaire",
    ],
  },
} as const

export default function SubscribePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userProfile, loading } = useSupabaseAuth()
  // Par defaut : Basic (jamais Pro). Pro reste un choix explicite de l'utilisateur.
  const rawPlanParam = searchParams.get("plan") || "basic"
  const validPlan: PlanChoice = ["basic", "pro", "discovery"].includes(rawPlanParam)
    ? (rawPlanParam as PlanChoice)
    : "basic"
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(validPlan)
  const [isAnnual, setIsAnnual] = useState(
    searchParams.get("billing") === "annual"
  )
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [country, setCountry] = useState<CountryCode>("CIV")
  const [provider, setProvider] = useState<string>("ORANGE_CIV")

  // Code promo LAVEIYE (3 mois Basic à 10 000 FCFA)
  const [promoInput, setPromoInput] = useState("")
  const [isCheckingPromo, setIsCheckingPromo] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    plan: "basic" | "pro"
    planLabel: string
    price: number
    originalPrice: number
    durationDays: number
    durationLabel: string
    billing: string
  } | null>(null)

  const countryConfig = COUNTRIES[country]
  const providersForCountry = PAWAPAY_PROVIDERS.filter(p => p.country === country)
  const maxLocalDigits = countryConfig.localLength
  const cleanLocal = phoneNumber.replace(/\D/g, '')
  const isPhoneValid = cleanLocal.length === maxLocalDigits

  /** Quand on change de pays, reset l'opérateur et le numéro. */
  const handleCountryChange = (next: CountryCode) => {
    setCountry(next)
    const firstProvider = PAWAPAY_PROVIDERS.find(p => p.country === next)
    if (firstProvider) setProvider(firstProvider.value)
    setPhoneNumber("")
  }

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLocalDigits)
    setPhoneNumber(formatPhoneMask(digits, countryConfig.mask))
  }

  useEffect(() => {
    if (!loading && !user) {
      // Préserver le plan/billing sélectionnés dans l'URL après login,
      // sinon l'utilisateur retombe sur le plan par défaut (Pro) au retour.
      const qs = searchParams.toString()
      const redirect = qs ? `/subscribe?${qs}` : '/subscribe'
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`)
    }
  }, [user, loading, router, searchParams])

  const subscriptionEndDate = userProfile?.subscription_end_date
    ? new Date(userProfile.subscription_end_date)
    : null
  const isActive =
    userProfile?.subscription_status === "active" &&
    subscriptionEndDate &&
    subscriptionEndDate > new Date()
  const daysRemaining = isActive
    ? Math.ceil(
        (subscriptionEndDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0

  const currentPlan = PLANS[selectedPlan]

  // Rang des plans pour interdire les downgrades quand l'abonnement
  // est encore actif. Doit rester aligné avec le check serveur dans
  // /api/payment/subscribe (PLAN_RANK).
  const PLAN_RANKS: Record<PlanChoice, number> = {
    discovery: 1,
    basic: 2,
    pro: 3,
  }
  // Fenêtre de renouvellement — alignée avec le serveur (RENEWAL_WINDOW_DAYS).
  const RENEWAL_WINDOW_DAYS = 7
  const inRenewalWindow = isActive && daysRemaining <= RENEWAL_WINDOW_DAYS
  const currentPlanKey = (userProfile?.plan || 'Free').toLowerCase()
  const currentPlanRank: number =
    currentPlanKey === 'pro' ? 3
    : currentPlanKey === 'basic' ? 2
    : currentPlanKey === 'discovery' ? 1
    : 0
  /**
   * Un plan est verrouillé UNIQUEMENT si l'abonnement est actif, de rang supérieur,
   * ET qu'on est en dehors de la fenêtre de renouvellement. À l'intérieur de la
   * fenêtre, l'utilisateur peut downgrader.
   */
  const isPlanLocked = (key: PlanChoice) =>
    !!isActive && PLAN_RANKS[key] < currentPlanRank && !inRenewalWindow

  // Si le plan présélectionné via ?plan=... est inférieur au plan actif,
  // basculer sur le plan actif pour éviter d'afficher une carte "downgrade".
  useEffect(() => {
    if (isActive && isPlanLocked(selectedPlan)) {
      const fallback: PlanChoice =
        currentPlanRank === 3 ? 'pro'
        : currentPlanRank === 2 ? 'basic'
        : 'discovery'
      setSelectedPlan(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentPlanRank])

  /** Valide un code promo auprès de l'API et applique l'offre. */
  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Saisissez un code")
      return
    }
    setIsCheckingPromo(true)
    setPromoError(null)
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setPromoError(data.error || "Code promo invalide")
        setAppliedPromo(null)
        return
      }
      setAppliedPromo({
        code,
        plan: data.offer.plan,
        planLabel: data.offer.planLabel,
        price: data.offer.price,
        originalPrice: data.offer.originalPrice,
        durationDays: data.offer.durationDays,
        durationLabel: data.offer.durationLabel,
        billing: data.offer.billing || 'promo3m',
      })
      // Forcer la sélection du plan correspondant à l'offre promo
      setSelectedPlan(data.offer.plan)
      setIsAnnual(false)
    } catch {
      setPromoError("Impossible de vérifier le code pour le moment")
    } finally {
      setIsCheckingPromo(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoInput("")
    setPromoError(null)
  }

  const PLAN_PRICES_MAP: Record<PlanChoice, { monthly: number; annual: number }> = {
    discovery: { monthly: 1000, annual: 10000 },
    basic: { monthly: 4900, annual: 49000 },
    pro: { monthly: 9900, annual: 99000 },
  }

  /** Montant à payer (override si code promo appliqué). */
  const finalAmount = appliedPromo
    ? appliedPromo.price
    : isAnnual
      ? PLAN_PRICES_MAP[selectedPlan].annual
      : PLAN_PRICES_MAP[selectedPlan].monthly

  const finalAmountFormatted = new Intl.NumberFormat("fr-FR").format(finalAmount)
  const finalDurationDays = appliedPromo ? appliedPromo.durationDays : (isAnnual ? 365 : 30)
  const finalDurationLabel = appliedPromo
    ? appliedPromo.durationLabel
    : (isAnnual ? "1 an" : "1 mois")

  const handlePayment = async () => {
    if (!user?.email) {
      alert("Vous devez être connecté pour effectuer un paiement")
      return
    }

    const localDigits = phoneNumber.replace(/\D/g, '')
    if (localDigits.length !== countryConfig.localLength) {
      alert(`Le numéro doit comporter ${countryConfig.localLength} chiffres pour ${countryConfig.name}.`)
      return
    }
    if (!provider) {
      alert("Veuillez choisir votre opérateur Mobile Money.")
      return
    }
    // Format international (sans “+”) : indicatif pays + numéro local
    const cleanedPhone = `${countryConfig.dialCode}${localDigits}`

    setIsProcessing(true)

    try {
      const response = await fetch("/api/payment/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user.email,
          userName: userProfile?.name || user.user_metadata?.name,
          plan: selectedPlan,
          billing: appliedPromo ? appliedPromo.billing : (isAnnual ? 'annual' : 'monthly'),
          phoneNumber: cleanedPhone,
          provider,
          currency: countryConfig.currency,
          promoCode: appliedPromo?.code,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const failure = data.failureReason
          ? `${data.failureReason.failureCode}: ${data.failureReason.failureMessage}`
          : null
        const message = [data.error, failure, data.details].filter(Boolean).join(" — ")
        throw new Error(message || "Erreur lors de la création du paiement")
      }

      sessionStorage.setItem("payment_ref", data.ref_command)

      // Flow Wave : redirection vers authorizationUrl
      if (data.authorizationUrl || data.redirect_url) {
        window.location.href = data.authorizationUrl || data.redirect_url
        return
      }

      // Flow PIN : redirection vers la page d'attente qui polle le statut
      window.location.href = `/payment/pending?ref_command=${encodeURIComponent(data.ref_command)}`
    } catch (error) {
      console.error("Erreur de paiement:", error)
      alert(
        error instanceof Error ? error.message : "Erreur lors du paiement"
      )
      setIsProcessing(false)
    }
  }

  const plan = currentPlan

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#F5F5F5] bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-[#0F0F0F]/70 hover:text-[#0F0F0F]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" className="w-30" alt="" />
          </Link>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-[#0F0F0F]">
          {isActive
            ? "Prolonger ou changer de formule"
            : "Choisissez votre formule"}
        </h1>
        <p className="mt-2 text-center text-[#0F0F0F]/60">
          {isActive
            ? `${isAnnual ? '365' : '30'} jours supplémentaires seront ajoutés à votre abonnement`
            : "Débloquez l'accès complet à Laveiye"}
        </p>

        {/* Abonnement actif - info renouvellement */}
        {isActive && (
          <div className="mt-6 rounded-xl border-2 border-[#10B981] bg-[#10B981]/5 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-[#10B981] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-[#0F0F0F]">
                  Abonnement actif — {userProfile?.plan || "Pro"}
                </p>
                <p className="mt-1 text-sm text-[#0F0F0F]/70">
                  Il te reste{" "}
                  <span className="font-bold text-[#10B981]">
                    {daysRemaining} jour{daysRemaining > 1 ? "s" : ""}
                  </span>{" "}
                  (expire le{" "}
                  {subscriptionEndDate!.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  )
                </p>
                <p className="mt-1 text-sm text-[#0F0F0F]/70">
                  En renouvelant maintenant,{" "}
                  <span className="font-semibold">
                    {isAnnual ? '365 jours' : '30 jours'} seront ajoutés
                  </span>{" "}
                  à la fin de ton abonnement actuel.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toggle mensuel / annuel */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-[#0F0F0F]' : 'text-[#0F0F0F]/50'}`}>Mensuel</span>
          {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
          <button
            type="button"
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B33D] focus-visible:ring-offset-2 ${
              isAnnual ? 'bg-[#F2B33D]' : 'bg-[#F5F5F5]'
            }`}
            role="switch"
            aria-checked={isAnnual ? "true" : "false"}
            aria-label="Basculer entre facturation mensuelle et annuelle"
          >
            <span
              className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isAnnual ? 'translate-x-[26px]' : 'translate-x-[2px]'
              } mt-[1px]`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-[#0F0F0F]' : 'text-[#0F0F0F]/50'}`}>
            Annuel
            <span className="ml-1 inline-block rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-bold text-[#10B981]">2 mois offerts</span>
          </span>
        </div>

        {/* Plan Selection Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {/* Découverte Card */}
          <button
            type="button"
            disabled={isPlanLocked("discovery")}
            onClick={() => setSelectedPlan("discovery")}
            className={`rounded-xl border-2 p-5 text-left transition-all col-span-2 ${
              isPlanLocked("discovery")
                ? "border-[#F5F5F5] bg-[#F5F5F5]/40 opacity-60 cursor-not-allowed"
                : selectedPlan === "discovery"
                ? "border-[#0F0F0F] bg-[#0F0F0F]/5 shadow-lg"
                : "border-[#F5F5F5] bg-white hover:border-[#0F0F0F]/30"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-[#0F0F0F]">
                Découverte
                {isPlanLocked("discovery") && (
                  <span className="ml-2 inline-block rounded-full bg-[#0F0F0F]/10 px-2 py-0.5 text-[10px] font-bold text-[#0F0F0F]/60 align-middle">
                    Downgrade indisponible
                  </span>
                )}
              </h3>
              {selectedPlan === "discovery" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F0F]">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#0F0F0F]">
                {isAnnual ? '10 000' : '1 000'}
              </span>
              <span className="text-sm text-[#0F0F0F]/60">{isAnnual ? 'XOF/an' : 'XOF/mois'}</span>
            </div>
            {isAnnual ? (
              <p className="mt-1 text-xs text-[#10B981] font-medium">2 mois offerts — soit ~833 XOF/mois</p>
            ) : (
              <p className="mt-1 text-xs text-[#0F0F0F]/50">ou 10 000 XOF/an (2 mois offerts)</p>
            )}
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                10 campagnes / mois
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                5 recherches ou filtres / mois
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Alertes email hebdo
              </li>
            </ul>
          </button>

          {/* Basic Card */}
          <button
            type="button"
            disabled={isPlanLocked("basic")}
            onClick={() => setSelectedPlan("basic")}
            className={`rounded-xl border-2 p-5 text-left transition-all relative ${
              isPlanLocked("basic")
                ? "border-[#F5F5F5] bg-[#F5F5F5]/40 opacity-60 cursor-not-allowed"
                : selectedPlan === "basic"
                ? "border-[#10B981] bg-[#10B981]/5 shadow-lg shadow-[#10B981]/10"
                : "border-[#F5F5F5] bg-white hover:border-[#10B981]/30"
            }`}
          >
            <div className="absolute -top-3 right-3 bg-[#10B981] text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              {isPlanLocked("basic") ? "Indisponible" : "Populaire"}
            </div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-[#10B981]">Basic</h3>
              {selectedPlan === "basic" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981]">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#0F0F0F]">
                {isAnnual ? '49 000' : '4 900'}
              </span>
              <span className="text-sm text-[#0F0F0F]/60">{isAnnual ? 'XOF/an' : 'XOF/mois'}</span>
            </div>
            {isAnnual ? (
              <p className="mt-1 text-xs text-[#10B981] font-medium">soit ~4 083 XOF/mois</p>
            ) : (
              <p className="mt-1 text-xs text-[#0F0F0F]/50">soit 49 000 XOF/an</p>
            )}
            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Accès illimité
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Filtres avancés
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Collections & téléchargement
              </li>
            </ul>
          </button>

          {/* Pro Card */}
          <button
            type="button"
            onClick={() => setSelectedPlan("pro")}
            className={`rounded-xl border-2 p-5 text-left transition-all relative ${
              selectedPlan === "pro"
                ? "border-[#F2B33D] bg-[#F2B33D]/5 shadow-lg shadow-[#F2B33D]/10"
                : "border-[#F5F5F5] bg-white hover:border-[#F2B33D]/30"
            }`}
          >
            <div className="absolute -top-3 right-3 bg-[#F2B33D] text-[#0F0F0F] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              Premium
            </div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-[#F2B33D]">Pro</h3>
              {selectedPlan === "pro" && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F2B33D]">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#0F0F0F]">
                {isAnnual ? '99 000' : '9 900'}
              </span>
              <span className="text-sm text-[#0F0F0F]/60">{isAnnual ? 'XOF/an' : 'XOF/mois'}</span>
            </div>
            {isAnnual ? (
              <p className="mt-1 text-xs text-[#10B981] font-medium">soit ~8 250 XOF/mois</p>
            ) : (
              <p className="mt-1 text-xs text-[#0F0F0F]/50">soit 99 000 XOF/an</p>
            )}
            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Tout du Basic
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Recherches illimitées
              </li>
              <li className="flex items-center gap-2 text-xs text-[#0F0F0F]/70">
                <Check className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                Sessions expert #BigFiveDécrypte
              </li>
            </ul>
          </button>
        </div>

        {/* Features of selected plan */}
        <div className="mt-6 rounded-xl border border-[#F5F5F5] bg-[#F5F5F5]/10 p-5">
          <h3 className="text-sm font-semibold text-[#0F0F0F] mb-3">
            Ce qui est inclus dans le plan {plan.name} :
          </h3>
          <ul className="space-y-2.5">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981]/20 shrink-0">
                  <Check className="h-3 w-3 text-[#10B981]" />
                </div>
                <span className="text-sm text-[#0F0F0F]">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile Money — details de paiement PawaPay */}
        <div className="mt-6 rounded-xl border border-[#F5F5F5] bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#0F0F0F]">
            Paiement Mobile Money
          </h3>

          <div className="space-y-2">
            <Label htmlFor="pawapay-country">Pays</Label>
            <Select value={country} onValueChange={(v) => handleCountryChange(v as CountryCode)}>
              <SelectTrigger id="pawapay-country">
                <SelectValue placeholder="Choisissez votre pays" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COUNTRIES) as CountryCode[]).map((code) => (
                  <SelectItem key={code} value={code}>
                    <span className="mr-2">{COUNTRIES[code].flag}</span>
                    {COUNTRIES[code].name}
                    <span className="ml-2 text-xs text-[#0F0F0F]/50">+{COUNTRIES[code].dialCode}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pawapay-provider">Opérateur</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="pawapay-provider">
                <SelectValue placeholder="Choisissez votre opérateur" />
              </SelectTrigger>
              <SelectContent>
                {providersForCountry.map((p) => {
                  const logo = getOperatorLogo(p.value)
                  return (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        {logo && (
                          <img
                            src={logo.src}
                            alt={logo.alt}
                            className="h-5 w-5 rounded-sm object-contain bg-white"
                          />
                        )}
                        {p.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pawapay-phone">Numéro de téléphone</Label>
            <div className="relative flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
              <span className="flex select-none items-center gap-1.5 border-r border-input bg-[#F5F5F5]/60 px-3 text-sm text-[#0F0F0F]/70">
                <span>{countryConfig.flag}</span>
                <span className="font-medium">+{countryConfig.dialCode}</span>
              </span>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pawapay-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder={countryConfig.placeholder}
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="border-0 pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isProcessing}
                  aria-invalid={phoneNumber.length > 0 && !isPhoneValid}
                />
              </div>
            </div>
            <p className="text-xs text-[#0F0F0F]/50">
              Saisissez votre numéro local ({countryConfig.localLength} chiffres). L’indicatif <strong>+{countryConfig.dialCode}</strong> est ajouté automatiquement.
              Vous recevrez une notification sur votre téléphone pour confirmer avec votre code PIN.
            </p>
          </div>
        </div>

        {/* Code promo LAVEIYE */}
        <div className="mt-6 rounded-xl border border-[#F2B33D]/30 bg-[#F2B33D]/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-[#F2B33D]" />
            <h3 className="text-sm font-semibold text-[#0F0F0F]">
              Vous avez un code promo LAVEIYE&nbsp;?
            </h3>
          </div>
          <p className="text-xs text-[#0F0F0F]/60 mb-3">
            Code reçu lors de l'inscription au keynote. Donne droit à 3 mois d'accès Basic pour 10 000 FCFA TTC (au lieu de 14 700 FCFA).
          </p>

          {appliedPromo ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 text-[#10B981] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F0F0F] truncate">
                    {appliedPromo.code} appliqué
                  </p>
                  <p className="text-xs text-[#0F0F0F]/60">
                    {appliedPromo.planLabel} — {appliedPromo.durationLabel} pour{" "}
                    {new Intl.NumberFormat("fr-FR").format(appliedPromo.price)} FCFA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemovePromo}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0F0F0F]/60 hover:bg-[#0F0F0F]/5 hover:text-[#0F0F0F]"
                aria-label="Retirer le code promo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase())
                    setPromoError(null)
                  }}
                  placeholder="LAVEIYE-XXXX"
                  className="uppercase tracking-wider"
                  disabled={isCheckingPromo}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleApplyPromo()
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={isCheckingPromo || !promoInput.trim()}
                  variant="outline"
                  className="border-[#F2B33D] text-[#F2B33D] hover:bg-[#F2B33D]/10"
                >
                  {isCheckingPromo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Appliquer"
                  )}
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-[#E11D48]">{promoError}</p>
              )}
            </div>
          )}
        </div>

        {/* Terms */}
        <div className="mt-6 flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <label htmlFor="terms" className="text-sm text-[#0F0F0F]/60">
            {"J'accepte les"}{" "}
            <LegalModal
              defaultTab="cgv"
              trigger={
                <button
                  type="button"
                  className="text-[#F2B33D] hover:underline"
                >
                  CGV et la politique de confidentialité
                </button>
              }
            />
          </label>
        </div>

        {/* CTA */}
        <Button
          onClick={handlePayment}
          disabled={!acceptTerms || isProcessing}
          className="mt-6 h-12 w-full shadow-lg shadow-[#F2B33D]/25 bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white font-bold text-base"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirection en cours...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              {isActive ? "Renouveler" : "Payer"} — {finalAmountFormatted} XOF
            </>
          )}
        </Button>

        {/* Recap */}
        <div className="mt-6 rounded-xl border border-[#F5F5F5] bg-white p-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#0F0F0F]/60">
                {appliedPromo
                  ? `Offre LAVEIYE — ${appliedPromo.planLabel} (${appliedPromo.durationLabel})`
                  : `${isActive ? "Renouvellement" : "Abonnement"} Laveiye — ${plan.name} (${isAnnual ? 'Annuel' : 'Mensuel'})`}
              </span>
              <span className="font-medium text-[#0F0F0F]">
                {finalAmountFormatted} XOF
              </span>
            </div>
            {appliedPromo && (
              <div className="flex items-center justify-between text-[#10B981]">
                <span>Réduction code promo</span>
                <span className="font-medium">
                  −{new Intl.NumberFormat("fr-FR").format(appliedPromo.originalPrice - appliedPromo.price)} XOF
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#0F0F0F]/60">Durée ajoutée</span>
              <span className="text-[#0F0F0F]">+{finalDurationDays} jours ({finalDurationLabel})</span>
            </div>
            {isActive && (
              <div className="flex items-center justify-between">
                <span className="text-[#0F0F0F]/60">
                  Nouvelle date d{"'"}expiration
                </span>
                <span className="text-[#0F0F0F] font-medium">
                  {new Date(
                    subscriptionEndDate!.getTime() +
                      finalDurationDays * 24 * 60 * 60 * 1000
                  ).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {isAnnual && !appliedPromo && (
              <div className="flex items-center justify-between text-[#10B981]">
                <span>Économie par rapport au mensuel</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('fr-FR').format(
                    Math.max(
                      0,
                      PLAN_PRICES_MAP[selectedPlan].monthly * 12 -
                        PLAN_PRICES_MAP[selectedPlan].annual
                    )
                  )}{' '}
                  XOF
                </span>
              </div>
            )}
            <div className="border-t border-[#F5F5F5] pt-2 flex items-center justify-between">
              <span className="font-semibold text-[#0F0F0F]">Total</span>
              <span className="font-bold text-[#F2B33D]">
                {finalAmountFormatted} XOF
              </span>
            </div>
          </div>
        </div>

        {/* Compare link */}
        <p className="mt-4 text-center text-sm text-[#0F0F0F]/50">
          <Link
            href="/pricing"
            className="text-[#F2B33D] hover:underline"
          >
            Comparer toutes les formules
          </Link>
        </p>

        {/* Back to dashboard */}
        {isActive && (
          <Button asChild variant="outline" className="mt-4 h-11 w-full">
            <Link href="/dashboard">Retour à la bibliothèque</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
