"use client"

/**
 * Hook : exige un abonnement payant ACTIF pour acceder a la plateforme.
 *
 * Le plan "Free" a ete deprecie. Tout utilisateur sans souscription active
 * (Decouverte / Basic / Pro) est redirige vers /subscribe?required=1.
 *
 * Cas :
 *   - subscription_status === 'active' ET plan ∈ {Discovery,Basic,Pro} : acces normal.
 *   - Tout autre etat ('none', 'expired', 'cancelled', 'past_due', 'trialing'…)
 *     OU plan absent / 'Free' legacy : redirect bloquant vers /subscribe.
 *
 * Note securite : le redirect est UX. La protection des donnees doit etre
 * faite cote serveur (RLS Supabase + checks d'API).
 */

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthContext } from "@/components/auth-provider"
import { isLockedAccount } from "@/lib/pricing"

const SUBSCRIBE_PATH = "/subscribe"

/**
 * Renvoie un état permettant à la page appelante de :
 *   - bloquer le rendu pendant que la vérif est en cours (`checking`) ou que le
 *     redirect est en route (`locked`) — sinon le dashboard "flashe" avant le replace().
 *   - rendre librement quand `allowed` est true.
 */
export function useRequireActiveSubscription(): {
  checking: boolean
  locked: boolean
  allowed: boolean
} {
  const router = useRouter()
  const pathname = usePathname()
  const { user, userProfile, loading } = useAuthContext()

  const onSubscribePath = !!pathname?.startsWith(SUBSCRIBE_PATH)
  // Profil chargé = on connaît plan/status. Sinon on attend.
  const profileReady = !loading && (!user || userProfile !== null)
  const plan = (userProfile as any)?.plan as string | null | undefined
  const status = (userProfile as any)?.subscription_status as string | null | undefined
  const endDate = (userProfile as any)?.subscription_end_date as string | null | undefined
  const locked = profileReady && !!user && isLockedAccount(plan, status, endDate) && !onSubscribePath

  useEffect(() => {
    if (!locked) return
    router.replace(`${SUBSCRIBE_PATH}?required=1`)
  }, [locked, router])

  return {
    checking: !profileReady,
    locked,
    allowed: profileReady && (!user || onSubscribePath || !isLockedAccount(plan, status, endDate)),
  }
}
