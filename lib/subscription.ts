/**
 * Helper de calcul de l'état effectif de l'abonnement d'un utilisateur.
 *
 * 3 sources de vérité existent dans la table `users` :
 *   - `plan` : plan courant
 *   - `subscription_status` : 'active' | 'expired' | 'cancelled' | null
 *   - `subscription_end_date` : date d'expiration
 *   - `pending_plan` / `pending_plan_starts_at` : downgrade payé d'avance
 *
 * Le cron `check-subscriptions` applique les transitions une fois par jour.
 * Entre deux runs, l'app peut voir un état "incohérent" (end_date passée
 * mais status encore 'active', pending qui aurait dû basculer, etc.).
 *
 * Ce helper renvoie l'état CALCULÉ AU RUNTIME, indépendant du cron, pour
 * éviter les fenêtres d'inconsistance.
 */

import { toPlanSlug, type PlanSlug } from './pricing'

export interface RawUserSubscription {
  plan?: string | null
  subscription_status?: string | null
  subscription_end_date?: string | null
  pending_plan?: string | null
  pending_plan_starts_at?: string | null
  pending_duration_days?: number | null
  pending_billing?: string | null
}

export interface EffectiveSubscription {
  /** Plan effectif maintenant (peut différer de `users.plan` si pending a basculé). */
  plan: PlanSlug
  /** True si plan payant actif et non expiré. */
  isActive: boolean
  /** Date d'expiration courante (peut être recalculée depuis pending). */
  endDate: Date | null
  /** Plan programmé qui prendra effet à `pendingStartsAt`, si défini. */
  pending: { plan: PlanSlug; startsAt: Date } | null
  /** Status brut (active/expired/cancelled/locked). */
  status: 'active' | 'expired' | 'cancelled' | 'locked'
}

/**
 * Calcule l'état effectif d'un abonnement à l'instant T, sans toucher
 * la BDD. Le cron applique ensuite réellement les transitions.
 *
 * Règles :
 *   1. Si `pending_plan_starts_at <= now` ET `pending_plan` set : on
 *      considère que le pending est déjà actif (le cron va le persister
 *      bientôt) et on calcule un nouveau `endDate`.
 *   2. Sinon, on retourne l'état courant en vérifiant l'expiration.
 */
export function getEffectiveSubscription(
  user: RawUserSubscription,
  now: Date = new Date()
): EffectiveSubscription {
  const currentPlan = toPlanSlug(user.plan)
  const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null
  const rawStatus = String(user.subscription_status || '').toLowerCase()

  const pendingPlan = toPlanSlug(user.pending_plan)
  const pendingStartsAt = user.pending_plan_starts_at
    ? new Date(user.pending_plan_starts_at)
    : null

  // Cas 1 : pending arrive à échéance. On bascule virtuellement.
  if (pendingPlan !== 'locked' && pendingStartsAt && pendingStartsAt <= now) {
    const duration = user.pending_duration_days || 30
    const newEnd = new Date(pendingStartsAt.getTime() + duration * 24 * 60 * 60 * 1000)
    const isStillActive = newEnd > now
    return {
      plan: isStillActive ? pendingPlan : 'locked',
      isActive: isStillActive,
      endDate: newEnd,
      pending: null,
      status: isStillActive ? 'active' : 'expired',
    }
  }

  // Cas 2 : plan courant. On vérifie l'expiration au runtime.
  const isExpiredByDate = endDate !== null && endDate <= now
  const isCancelled = rawStatus === 'cancelled'
  const isLocked = currentPlan === 'locked' || rawStatus === 'locked'

  let status: EffectiveSubscription['status']
  if (isLocked) status = 'locked'
  else if (isCancelled) status = 'cancelled'
  else if (isExpiredByDate || rawStatus === 'expired') status = 'expired'
  else status = 'active'

  const isActive = status === 'active' && !isLocked

  return {
    plan: isActive ? currentPlan : 'locked',
    isActive,
    endDate,
    pending:
      pendingPlan !== 'locked' && pendingStartsAt
        ? { plan: pendingPlan, startsAt: pendingStartsAt }
        : null,
    status,
  }
}
