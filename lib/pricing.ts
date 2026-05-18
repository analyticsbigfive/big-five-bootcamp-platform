/**
 * Source de vérité des plans d'abonnement.
 *
 * Le tier "Free" est OFFICIELLEMENT DÉPRÉCIÉ. L'accès à la plateforme
 * exige strictement un abonnement payant actif.
 *
 * 3 plans payants :
 *   - Découverte (DB key: "Discovery") : entrée de gamme payante, accès limité
 *   - Basic                            : indépendants, accès illimité
 *   - Pro                              : pros, tout débloqué + séances expert
 *
 * État verrouillé (PLAN_LOCKED) : compte créé mais aucun abonnement actif
 * (plan = NULL ou subscription_status !== 'active'). L'utilisateur est
 * redirigé vers /subscribe par use-require-active-subscription jusqu'à
 * souscription d'un plan payant.
 */

export const PLAN_LOCKED = {
  name: "Non abonné",
  tagline: "Compte sans abonnement actif",
  price: 0,
  annualPrice: 0,
  clicksPerMonth: 0,
  searchesPerMonth: 0,
  features: {
    library: "locked" as const,
    filters: "locked" as const,
    campaignsPerMonth: 0,
    favorites: false,
    brandCollection: false,
    weeklyEmail: false,
    brandTracking: false,
    debriefSession: false,
    download: false,
    usageCounter: false,
    multiUsers: 0,
  },
}

export const PLAN_DISCOVERY = {
  name: "Découverte",
  tagline: "Pour explorer la plateforme",
  price: 1000,
  annualPrice: 10000,
  clicksPerMonth: 10,
  searchesPerMonth: 5,
  features: {
    library: "preview_scroll" as const,
    filters: "basic" as const,
    campaignsPerMonth: 10,
    favorites: false,
    brandCollection: false,
    weeklyEmail: true,
    brandTracking: false,
    debriefSession: false,
    download: false,
    usageCounter: true,
    multiUsers: 1,
  },
}

/** @deprecated Alias rétro-compat. À supprimer une fois les imports nettoyés. */
export const PLAN_FREE_LOCKED = PLAN_LOCKED
/** @deprecated Alias rétro-compat. */
export const PLAN_FREE = PLAN_LOCKED

export const PLAN_BASIC = {
  name: "Basic",
  tagline: "Pour les indépendants",
  price: 4900,
  annualPrice: 49000,
  clicksPerMonth: Infinity,
  searchesPerMonth: 30,
  features: {
    library: "full" as const,
    filters: "full" as const,
    campaignsPerMonth: Infinity,
    favorites: true,
    brandCollection: true,
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
  tagline: "Pour les créatifs exigeants",
  price: 9900,
  annualPrice: 99000,
  clicksPerMonth: Infinity,
  searchesPerMonth: Infinity,
  features: {
    library: "full" as const,
    filters: "full" as const,
    campaignsPerMonth: Infinity,
    favorites: true,
    brandCollection: true,
    weeklyEmail: true,
    brandTracking: true,
    debriefSession: true,
    download: true,
    usageCounter: true,
    multiUsers: 1,
  },
}

/** Identifiant technique stocké en base. L'accent de "Découverte" reste purement UI. */
export type PlanKey = "Discovery" | "Basic" | "Pro"

export const PLANS = {
  Discovery: PLAN_DISCOVERY,
  Basic: PLAN_BASIC,
  Pro: PLAN_PRO,
} as const

/**
 * Plan canonique (lowercase, slug stable). Source de vérité pour les
 * comparaisons côté code et les keys d'URL/payload. La BDD stocke en
 * `Discovery | Basic | Pro`, le code applicatif manipule la forme slug.
 *
 * Légacy "free" → 'locked' (compte verrouillé sans abonnement actif).
 * Valeurs inattendues → 'locked' (fail-safe : pas de fallback Pro/Basic).
 */
export type PlanSlug = 'discovery' | 'basic' | 'pro' | 'locked'

const PLAN_DB_KEY: Record<Exclude<PlanSlug, 'locked'>, 'Discovery' | 'Basic' | 'Pro'> = {
  discovery: 'Discovery',
  basic: 'Basic',
  pro: 'Pro',
}

/**
 * Normalise vers un slug canonique kebab : 'discovery' | 'basic' | 'pro' | 'locked'.
 * Coexiste avec `normalizePlan` historique (qui renvoie la forme Capitalized
 * ou null). Préférer `toPlanSlug` dans le nouveau code pour comparaisons.
 */
export function toPlanSlug(plan: string | null | undefined): PlanSlug {
  const p = String(plan || '').toLowerCase().trim()
  if (p === 'pro') return 'pro'
  if (p === 'basic') return 'basic'
  if (p === 'discovery') return 'discovery'
  return 'locked'
}

/** Forme DB (capitalisée) à utiliser dans les writes `users.plan = ...`. */
export function planSlugToDbKey(slug: PlanSlug): 'Discovery' | 'Basic' | 'Pro' | null {
  return slug === 'locked' ? null : PLAN_DB_KEY[slug]
}

/** Rang ordinal : locked < discovery < basic < pro. Utile pour comparer upgrade vs downgrade. */
export function planRank(slug: PlanSlug): number {
  if (slug === 'pro') return 3
  if (slug === 'basic') return 2
  if (slug === 'discovery') return 1
  return 0
}

export function getPlanConfig(plan: string | null | undefined) {
  switch ((plan || "").toLowerCase()) {
    case "pro":
      return PLAN_PRO
    case "basic":
      return PLAN_BASIC
    case "discovery":
      return PLAN_DISCOVERY
    // Aucun plan ou valeur inconnue (legacy "free" inclus) -> état verrouillé.
    default:
      return PLAN_LOCKED
  }
}

export function getPlanDisplayName(plan: string | null | undefined): string {
  return getPlanConfig(plan).name
}

/**
 * Indique si un plan donne accès illimité (Basic ou Pro).
 * Le plan Découverte a un accès limité même s'il est payant.
 */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const p = (plan || "").toLowerCase()
  return p === "basic" || p === "pro"
}

/**
 * Indique si un plan donne accès aux campagnes "premium" (réservées Basic+).
 */
export function canAccessPremiumContent(plan: string | null | undefined): boolean {
  const p = (plan || "").toLowerCase()
  return p === "basic" || p === "pro"
}

/**
 * Indique si l'utilisateur n'a aucun abonnement actif.
 * Aucun accès n'est autorisé tant que cette fonction renvoie true —
 * use-require-active-subscription redirige alors vers /subscribe.
 *
 * Verrouille également si la date de fin est passée, même si le cron
 * /api/cron/check-subscriptions n'a pas encore basculé le status.
 */
export function isLockedAccount(
  plan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
  subscriptionEndDate?: string | Date | null,
): boolean {
  const status = (subscriptionStatus || "").toLowerCase()
  if (status !== "active") return true
  const p = (plan || "").toLowerCase()
  if (!(p === "discovery" || p === "basic" || p === "pro")) return true
  // Filet de sécurité coté client : si la fin d'abonnement est dépassée,
  // on considère le compte verrouillé même si le status DB est encore 'active'.
  if (subscriptionEndDate) {
    const end = subscriptionEndDate instanceof Date
      ? subscriptionEndDate
      : new Date(subscriptionEndDate)
    if (!isNaN(end.getTime()) && end.getTime() <= Date.now()) return true
  }
  return false
}

/** @deprecated Utiliser `isLockedAccount`. Conservé pour rétro-compat. */
export const isLockedFreePlan = isLockedAccount

/** Normalise vers un PlanKey canonique. Renvoie null si aucun plan reconnu. */
export function normalizePlan(plan: string | null | undefined): PlanKey | null {
  const p = (plan || "").toLowerCase()
  if (p === "pro" || p === "premium" || p === "agency" || p === "enterprise") return "Pro"
  if (p === "basic") return "Basic"
  if (p === "discovery") return "Discovery"
  // Legacy "Free" ou inconnu -> null (compte verrouillé)
  return null
}
