-- =============================================================================
-- Campaigns : Row Level Security (RLS) + restriction de colonnes premium
-- À exécuter dans le SQL Editor Supabase (ou via la CLI de migration).
-- =============================================================================
--
-- Contexte
-- --------
-- La clé `anon` est publique (visible dans le bundle JS du navigateur). Sans
-- RLS, n'importe qui peut appeler directement l'API PostgREST de Supabase
-- (https://<projet>.supabase.co/rest/v1/campaigns?select=*) et récupérer TOUT
-- le contenu — brouillons et champs premium (analyse, how_to_use) compris — en
-- contournant entièrement les routes Next.js. C'est la faille signalée :
-- "j'ai modifié la requête qui limitait le contenu pour avoir tout".
--
-- La protection ne doit donc PAS dépendre du front. Elle est posée ici, au
-- niveau de la base, et s'applique à tout client utilisant la clé anon ou un
-- JWT utilisateur. Le `service_role` (utilisé côté serveur par les routes API
-- et les server actions) possède l'attribut BYPASSRLS : le code serveur n'est
-- pas impacté et continue d'appliquer son propre filtrage par plan.
--
-- Modèle d'accès appliqué
-- -----------------------
--   anon (non connecté)      : lecture des campagnes publiées UNIQUEMENT, et
--                              SANS les colonnes premium (analyse, how_to_use).
--   authenticated (connecté) : lecture des campagnes publiées UNIQUEMENT
--                              (toutes colonnes — les cartes de la bibliothèque
--                              affichent how_to_use côté client).
--   service_role (serveur)   : accès complet (BYPASSRLS), filtrage par plan
--                              assuré dans le code (lib/content-access.ts).
--   écritures (INSERT/UPDATE/DELETE) : refusées à anon & authenticated faute de
--                              policy ; elles passent par le service_role.
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- =============================================================================

-- 1) Activer RLS -------------------------------------------------------------
alter table public.campaigns enable row level security;
-- Forcer RLS même pour le propriétaire de la table (défense en profondeur).
alter table public.campaigns force row level security;

-- 2) Lecture : campagnes publiées uniquement (anon + authenticated) ----------
drop policy if exists campaigns_select_published on public.campaigns;
create policy campaigns_select_published
  on public.campaigns
  for select
  to anon, authenticated
  using (status = 'Publié');

-- 3) Restriction de colonnes pour anon ---------------------------------------
-- RLS est "row-level" : il ne masque pas les colonnes premium sur une ligne
-- publiée. On retire donc à `anon` le SELECT global puis on le ré-accorde sur
-- toutes les colonnes SAUF analyse / how_to_use. Construit dynamiquement depuis
-- le catalogue : robuste aux ajouts de colonnes (toute nouvelle colonne est
-- accordée à anon, hormis les deux champs premium listés ci-dessous).
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

  -- Repartir d'une base propre pour anon (idempotence).
  revoke select on public.campaigns from anon;
  if granted_cols is not null then
    execute format('grant select (%s) on public.campaigns to anon', granted_cols);
  end if;
end $$;

-- 4) S'assurer que les rôles serveur conservent un accès complet -------------
-- (service_role bypasse déjà RLS ; on (re)pose les grants par sûreté.)
grant select on public.campaigns to authenticated;
grant all on public.campaigns to service_role;

-- =============================================================================
-- Vérification rapide (à lancer manuellement) :
--
--   set role anon;
--   select analyse from public.campaigns limit 1;   -- doit ÉCHOUER (permission denied)
--   select id, title from public.campaigns limit 1; -- OK, publiées uniquement
--   reset role;
--
-- =============================================================================
-- Rollback (si besoin) :
--
--   drop policy if exists campaigns_select_published on public.campaigns;
--   alter table public.campaigns no force row level security;
--   alter table public.campaigns disable row level security;
--   grant select on public.campaigns to anon;
-- =============================================================================
