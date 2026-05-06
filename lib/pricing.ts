/**
 * Source de vérité des plans d'abonnement (avril 2026)
 *
 * 3 plans officiels :
 *   - Free  (affiché "Découverte")  : explorateurs, accès limité
 *   - Basic                         : indépendants, accès illimité
 *   - Pro                           : pros, tout débloqué + suivi de marques
 *
 * L'identifiant technique en base reste "Free" pour éviter les problèmes
 * d'encodage (é) et les cascades de refactoring.
 */

export const PLAN_FREE = {
  name: "Découverte",
  tagline: "Pour les explorateurs",
  price: 0,
  annualPrice: null as number | null,
  clicksPerMonth: 5,
  searchesPerDay: 3,
  features: {
    library: "preview_scroll" as const, // accès limité
    filters: "basic" as const,          // filtres basiques
    campaignsPerDay: 3,                  // 3 campagnes consultables / jour
    favorites: true,
    brandCollection: false,              // pas de collections personnalisées
    weeklyEmail: true,
    brandTracking: false,
    debriefSession: false,
    download: false,
    usageCounter: false,
    multiUsers: 1,
  },
}

export const PLAN_BASIC = {
  name: "Basic",
  tagline: "Pour les indépendants",
  price: 4900,
  annualPrice: 49000,
  clicksPerMonth: Infinity,
  searchesPerDay: 15,
  features: {
    library: "full" as const,           // accès illimité
    filters: "full" as const,            // filtres avancés (secteur, pays...)
    campaignsPerDay: Infinity,
    favorites: true,
    brandCollection: true,               // collections personnalisées
    weeklyEmail: true,
    brandTracking: false,
    debriefSession: false,
    download: true,
    usageCounter: true,
    multiUsers: 1,
  },
}

export const PLAN_PRO = {
  name: "Pro",
  tagline: "Pour les professionnels",
  price: 9900,
  annualPrice: 99000,
  clicksPerMonth: Infinity,
  searchesPerDay: Infinity,               // recherches illimitées
  features: {
    library: "full" as const,
    filters: "full" as const,
    campaignsPerDay: Infinity,
    favorites: true,
    brandCollection: true,
    weeklyEmail: true,
    brandTracking: true,                 // suivi de marques
    debriefSession: true,                // séance de débrief avec l'équipe Big Five
    download: true,
    usageCounter: true,
    multiUsers: 1,
  },
}

/** Identifiant technique stocké en base. L'accent de "Découverte" reste purement UI. */
export type PlanKey = "Free" | "Basic" | "Pro"

export const PLANS = {
  Free: PLAN_FREE,
  Basic: PLAN_BASIC,
  Pro: PLAN_PRO,
} as const

export function getPlanConfig(plan: string | null | undefined) {
  switch ((plan || "").toLowerCase()) {
    case "pro":
      return PLAN_PRO
    case "basic":
      return PLAN_BASIC
    default:
      return PLAN_FREE
  }
}

export function getPlanDisplayName(plan: string | null | undefined): string {
  return getPlanConfig(plan).name
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  const p = (plan || "").toLowerCase()
  return p === "basic" || p === "pro"
}

/**
 * Indique si un plan donne accès aux campagnes "premium" (réservées).
 * Seul le plan Pro débloque ce contenu — les comptes Free et Basic sont exclus.
 */
export function canAccessPremiumContent(plan: string | null | undefined): boolean {
  return (plan || "").toLowerCase() === "pro"
}

/** Normalise vers un PlanKey canonique (les anciens noms sont rétro-compatibles). */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const p = (plan || "").toLowerCase()
  if (p === "pro" || p === "premium" || p === "agency" || p === "enterprise") return "Pro"
  if (p === "basic") return "Basic"
  return "Free"
}
