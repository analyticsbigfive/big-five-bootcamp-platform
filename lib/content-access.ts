import { getAuthenticatedUser } from "@/lib/supabase-server"
import { canAccessPremiumContent } from "@/lib/pricing"

/**
 * Contrôle d'accès serveur pour le contenu des campagnes.
 *
 * Rappel sécurité (cf. hooks/use-require-active-subscription.ts) : le redirect
 * client n'est que de l'UX. La donnée doit être filtrée ici, côté serveur,
 * sinon n'importe qui peut lire le contenu via l'API sans compte.
 *
 * Trois niveaux de visibilité :
 *   - anonyme           : uniquement les champs "carte" (teaser). Aucune donnée
 *                         stratégique (analyse, how_to_use, description...).
 *   - connecté non-payant: contenu standard, mais les champs premium sont
 *                         retirés sur les campagnes `access_level = premium`.
 *   - premium / admin    : accès complet.
 */

/** Champs exposables publiquement (teasers login/subscribe). */
export const CAMPAIGN_CARD_FIELDS = [
  "id",
  "title",
  "slug",
  "brand",
  "category",
  "thumbnail",
  "platforms",
  "country",
  "format",
  "year",
  "tags",
  "access_level",
  "featured",
  "created_at",
] as const

/** Champs premium réservés aux comptes Basic/Pro (ou admin). */
const PREMIUM_FIELDS = ["analyse", "how_to_use"] as const

export type ViewerAccess = {
  isAuthenticated: boolean
  isAdmin: boolean
  canPremium: boolean
}

/** Résout le niveau d'accès du visiteur courant à partir de sa session. */
export async function getViewerAccess(): Promise<ViewerAccess> {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { isAuthenticated: false, isAdmin: false, canPremium: false }
  }
  const plan = (user.profile as any)?.plan
  return {
    isAuthenticated: true,
    isAdmin: !!user.isAdmin,
    canPremium: !!user.isAdmin || canAccessPremiumContent(plan),
  }
}

function pickCardFields<T extends Record<string, any>>(campaign: T): Partial<T> {
  const card: Record<string, any> = {}
  for (const field of CAMPAIGN_CARD_FIELDS) {
    if (field in campaign) card[field] = campaign[field]
  }
  return card as Partial<T>
}

/**
 * Retire les champs premium (`analyse`, `how_to_use`) d'une campagne
 * `access_level = premium` quand le viewer n'a pas le droit premium.
 *
 * Ne réduit PAS aux champs carte : conserve tout le reste (description,
 * vidéo, analyse du contenu gratuit...). À utiliser pour les vues complètes
 * (page détail, dashboard) qui restent des teasers publics pour le contenu
 * non-premium. Pour le contenu premium, c'est le seul filet côté serveur :
 * les pages masquent l'affichage, mais la donnée ne doit jamais transiter.
 */
export function redactPremiumFields<T extends Record<string, any>>(
  campaign: T,
  viewer: ViewerAccess,
): Partial<T> {
  if (!campaign) return campaign
  if (viewer.canPremium) return campaign

  const isPremiumContent =
    String((campaign as any).access_level || "").toLowerCase() === "premium"
  if (!isPremiumContent) return campaign

  const sanitized: Record<string, any> = { ...campaign }
  for (const field of PREMIUM_FIELDS) {
    if (field in sanitized) sanitized[field] = null
  }
  return sanitized as Partial<T>
}

export function redactPremiumFieldsList<T extends Record<string, any>>(
  campaigns: T[],
  viewer: ViewerAccess,
): Partial<T>[] {
  return (campaigns || []).map((c) => redactPremiumFields(c, viewer))
}

/**
 * Projette une campagne selon le niveau d'accès du visiteur.
 * - anonyme : champs carte uniquement.
 * - connecté non-premium : champs premium retirés si `access_level = premium`.
 * - premium / admin : objet complet.
 */
export function projectCampaign<T extends Record<string, any>>(
  campaign: T,
  viewer: ViewerAccess,
): Partial<T> {
  if (!campaign) return campaign
  if (!viewer.isAuthenticated) return pickCardFields(campaign)
  return redactPremiumFields(campaign, viewer)
}

export function projectCampaigns<T extends Record<string, any>>(
  campaigns: T[],
  viewer: ViewerAccess,
): Partial<T>[] {
  return (campaigns || []).map((c) => projectCampaign(c, viewer))
}
