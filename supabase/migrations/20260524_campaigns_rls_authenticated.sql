-- =============================================================================
-- Campaigns : backstop colonne premium pour le rôle `authenticated`
-- À exécuter dans le SQL Editor Supabase APRÈS 20260524_campaigns_rls.sql.
-- =============================================================================
--
-- ⚠️ ORDRE DE DÉPLOIEMENT IMPÉRATIF
-- ----------------------------------
-- Ce script retire les colonnes `analyse` / `how_to_use` au rôle
-- `authenticated`. Il ne doit être appliqué QU'APRÈS le déploiement du code
-- qui route le dashboard et la page détail via le serveur (server actions
-- getDashboardCampaigns / getCreativeByIdOrSlug, qui appliquent le filtrage
-- premium en service_role). Sinon, le dashboard d'un utilisateur connecté
-- (requête directe au JWT) recevrait `permission denied` sur ces colonnes.
--
-- Contexte
-- --------
-- 20260524_campaigns_rls.sql fermait l'accès direct pour `anon`. Mais
-- `authenticated` gardait l'accès complet aux colonnes, parce que le dashboard
-- interrogeait alors Supabase directement avec le JWT. Conséquence : un compte
-- gratuit connecté pouvait lire `analyse` / `how_to_use` en rejouant la requête
-- PostgREST avec son token (ou simplement dans l'onglet Réseau), le filtrage
-- n'étant fait que côté client.
--
-- Le code serveur ne dépend plus de ces colonnes côté client : on peut donc
-- les retirer au rôle `authenticated`. Le filtrage premium reste assuré en
-- service_role (BYPASSRLS) dans les server actions, par plan.
--
-- Modèle d'accès après ce script
-- ------------------------------
--   anon          : campagnes publiées, SANS analyse / how_to_use (déjà posé).
--   authenticated : campagnes publiées, SANS analyse / how_to_use (ce script).
--   service_role  : accès complet (BYPASSRLS) — filtrage par plan dans le code.
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- =============================================================================

-- Retirer le SELECT global à `authenticated` puis le ré-accorder sur toutes les
-- colonnes SAUF analyse / how_to_use. Construit dynamiquement depuis le catalogue
-- (robuste aux ajouts de colonnes : toute nouvelle colonne est accordée, hormis
-- les deux champs premium).
do $$
declare
  premium_cols constant text[] := array['analyse', 'how_to_use'];
  granted_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into granted_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'campaigns'
    and not (column_name = any(premium_cols));

  revoke select on public.campaigns from authenticated;
  if granted_cols is not null then
    execute format('grant select (%s) on public.campaigns to authenticated', granted_cols);
  end if;
end $$;

-- service_role conserve tout (par sûreté ; il bypasse déjà RLS).
grant all on public.campaigns to service_role;

-- =============================================================================
-- Vérification rapide (à lancer manuellement) :
--
--   set role authenticated;
--   select analyse from public.campaigns limit 1;   -- doit ÉCHOUER (permission denied)
--   select id, title from public.campaigns limit 1; -- OK, publiées uniquement
--   reset role;
--
-- =============================================================================
-- Rollback (si besoin) — redonne l'accès complet à `authenticated` :
--
--   grant select on public.campaigns to authenticated;
-- =============================================================================
