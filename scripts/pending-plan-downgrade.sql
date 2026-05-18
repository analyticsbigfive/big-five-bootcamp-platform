-- =============================================================================
-- Migration : Downgrade payé immédiat avec activation différée
-- =============================================================================
-- Permet à un utilisateur de payer dès maintenant un plan INFÉRIEUR au sien,
-- tout en conservant son plan actuel jusqu'à `subscription_end_date`.
-- À expiration, le plan en attente prend le relais (via cron).
--
-- Colonnes ajoutées sur `public.users` :
--   - pending_plan            : 'Discovery' | 'Basic' | 'Pro' (NULL si rien en attente)
--   - pending_plan_starts_at  : timestamp d'activation (= subscription_end_date courant
--                               au moment du paiement)
--   - pending_billing         : 'monthly' | 'annual' | 'promo3m'
--   - pending_duration_days   : nombre de jours à appliquer une fois activé
--
-- À exécuter dans Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pending_plan TEXT,
  ADD COLUMN IF NOT EXISTS pending_plan_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_billing TEXT,
  ADD COLUMN IF NOT EXISTS pending_duration_days INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_pending_plan_starts_at
  ON public.users (pending_plan_starts_at)
  WHERE pending_plan IS NOT NULL;

COMMENT ON COLUMN public.users.pending_plan IS
  'Plan en attente d''activation après expiration du plan courant (downgrade payé d''avance).';
COMMENT ON COLUMN public.users.pending_plan_starts_at IS
  'Date à laquelle le pending_plan doit devenir actif (= subscription_end_date au moment du paiement).';
