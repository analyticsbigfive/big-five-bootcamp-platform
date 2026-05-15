-- ============================================================================
-- Security fixes : Supabase Linter
--   1. RLS désactivée sur public.payments + colonne sensible session_id exposée
--   2. View public.v_user_daily_quotas en SECURITY DEFINER (bypass RLS)
--
-- À exécuter dans Supabase SQL Editor.
-- Idempotent : peut être relancé sans casse.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) public.payments — activer RLS + policies restrictives
-- ----------------------------------------------------------------------------
-- Lien user = colonne user_email (pas user_id sur cette table).
-- Toute écriture passe par le service role (routes API serveur) → on n'ouvre
-- aucune écriture côté client. Seule lecture autorisée : l'utilisateur peut
-- voir ses propres paiements (pour /settings, page reçu, etc.).

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select
  using (
    -- comparaison case-insensitive sur l'email pour matcher la convention auth
    lower(user_email) = lower((auth.jwt() ->> 'email'))
  );

-- Aucune policy INSERT/UPDATE/DELETE côté client : le service role
-- (supabaseAdmin) bypasse RLS pour les opérations serveur, mais aucun
-- utilisateur authentifié ne peut écrire directement dans payments.
drop policy if exists "payments_insert_block" on public.payments;
drop policy if exists "payments_update_block" on public.payments;
drop policy if exists "payments_delete_block" on public.payments;

-- ----------------------------------------------------------------------------
-- 2) Vue v_user_daily_quotas — passer en SECURITY INVOKER (alternative sûre)
-- ----------------------------------------------------------------------------
-- Une vue SECURITY DEFINER s'exécute avec les droits du créateur (souvent
-- postgres), ce qui contourne les RLS des tables sous-jacentes. On bascule
-- en SECURITY INVOKER pour que la vue respecte les policies de l'appelant.
-- Postgres 15+ supporte security_invoker via ALTER VIEW.

do $$
begin
  if exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'v_user_daily_quotas'
  ) then
    execute 'alter view public.v_user_daily_quotas set (security_invoker = true)';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3) Vérifications
-- ----------------------------------------------------------------------------
-- a) RLS activée + policies sur payments
select relname, relrowsecurity
  from pg_class
  where relname = 'payments' and relnamespace = 'public'::regnamespace;

select policyname, cmd, qual
  from pg_policies
  where schemaname = 'public' and tablename = 'payments';

-- b) Options de la vue
select c.relname,
       (select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker') as security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'v_user_daily_quotas';
