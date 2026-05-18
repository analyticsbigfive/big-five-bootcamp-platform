-- =============================================================================
-- Reset des compteurs mensuels : vues (clicks) + recherches/filtres
-- =============================================================================
-- À exécuter dans Supabase SQL Editor.
--
-- Reinitialise pour TOUS les utilisateurs :
--   - daily_click_count              (compteur consultations campagnes actif)
--   - daily_click_reset              (date du mois courant : YYYY-MM-01)
--   - monthly_click_count            (ancien compteur consultations, legacy)
--   - monthly_campaigns_explored     (compteur d'exploration)
--   - daily_search_count             (JSONB des recherches+filtres du mois)
--   - daily_search_reset             (date du mois courant : YYYY-MM-01)
--   - monthly_click_reset            (timestamp de dernier reset legacy)
--
-- Logs détaillés (search_logs) : NON purgés par défaut. Décommenter en bas
-- si tu veux aussi vider l'historique des recherches.
--
-- Utilisation : un seul run. Le cron mensuel `check-subscriptions` reset
-- naturellement chaque 1er du mois — ce script ne sert qu'à un reset
-- manuel ponctuel (incident / tests / nouveau cycle commercial).
-- =============================================================================

BEGIN;

-- 1. Snapshot avant : pour audit post-run
SELECT
  COUNT(*)                                                   AS users_count,
  COUNT(*) FILTER (WHERE COALESCE(daily_click_count, 0) > 0) AS users_avec_vues,
  COALESCE(SUM(daily_click_count), 0)                        AS total_vues,
  COUNT(*) FILTER (WHERE COALESCE(monthly_click_count, 0) > 0) AS users_avec_clicks_legacy,
  COALESCE(SUM(monthly_click_count), 0)                      AS total_clicks_legacy,
  COUNT(*) FILTER (WHERE COALESCE(monthly_campaigns_explored, 0) > 0) AS users_avec_explorations,
  COALESCE(SUM(monthly_campaigns_explored), 0)               AS total_explorations,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(daily_search_count) = 'object'
      AND daily_search_count <> '{}'::jsonb
  )                                                          AS users_avec_recherches,
  COALESCE(SUM(COALESCE((daily_search_count ->> '_shared')::integer, 0)), 0) AS total_recherches_filtres
FROM public.users;

-- 2. Reset
-- Note : daily_click_reset et daily_search_reset sont des DATE.
-- On stocke donc le 1er jour du mois courant, pas un texte "YYYY-MM".
WITH current_period AS (
  SELECT
    date_trunc('month', now() AT TIME ZONE 'UTC')::date AS month_start,
    now() AS reset_at
)
UPDATE public.users
SET
  daily_click_count          = 0,
  daily_click_reset          = current_period.month_start,
  monthly_click_count        = 0,
  monthly_campaigns_explored = 0,
  daily_search_count         = '{}'::jsonb,
  daily_search_reset         = current_period.month_start,
  monthly_click_reset        = current_period.reset_at,
  updated_at                 = current_period.reset_at
FROM current_period;

-- 3. Snapshot après : doit afficher 0 partout
SELECT
  COUNT(*)                                                   AS users_count,
  COUNT(*) FILTER (WHERE COALESCE(daily_click_count, 0) > 0) AS users_avec_vues,
  COALESCE(SUM(daily_click_count), 0)                        AS total_vues,
  COUNT(*) FILTER (WHERE COALESCE(monthly_click_count, 0) > 0) AS users_avec_clicks_legacy,
  COALESCE(SUM(monthly_click_count), 0)                      AS total_clicks_legacy,
  COUNT(*) FILTER (WHERE COALESCE(monthly_campaigns_explored, 0) > 0) AS users_avec_explorations,
  COALESCE(SUM(monthly_campaigns_explored), 0)               AS total_explorations,
  COUNT(*) FILTER (WHERE daily_search_count <> '{}'::jsonb)  AS users_avec_recherches,
  COALESCE(SUM(COALESCE((daily_search_count ->> '_shared')::integer, 0)), 0) AS total_recherches_filtres
FROM public.users;

-- 4. Verification des dates de reset : daily_*_reset doit etre YYYY-MM-01
SELECT
  daily_click_reset,
  daily_search_reset,
  COUNT(*) AS users_count
FROM public.users
GROUP BY daily_click_reset, daily_search_reset
ORDER BY daily_click_reset, daily_search_reset;

-- ─── Optionnel : purge des logs détaillés de recherche ───
-- Décommenter pour aussi vider la table search_logs (historique des recherches).
-- DELETE FROM public.search_logs;

COMMIT;
