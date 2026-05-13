-- Migration: Table de liaison brand_request_campaigns
--
-- Permet à l'admin de rattacher manuellement des campagnes (table public.campaigns)
-- à une demande de suivi de marque (table public.brand_requests).
--
-- Remplace l'association automatique (marque + pays + secteurs + plateformes)
-- effectuée auparavant côté API. Désormais : c'est 100% géré par l'équipe admin.
--
-- À exécuter dans le SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS public.brand_request_campaigns (
  brand_request_id UUID NOT NULL REFERENCES public.brand_requests(id) ON DELETE CASCADE,
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id)      ON DELETE CASCADE,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (brand_request_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_brc_brand_request_id
  ON public.brand_request_campaigns (brand_request_id);

CREATE INDEX IF NOT EXISTS idx_brc_campaign_id
  ON public.brand_request_campaigns (campaign_id);

-- RLS : aucun accès direct côté client. Tout passe par les routes API
-- (`/api/admin/brand-requests/[id]/campaigns` côté admin et
-- `/api/brand-requests/[id]/contents` / `/api/dashboard/brand-monitoring`
-- côté utilisateur, exécutées avec service role).
ALTER TABLE public.brand_request_campaigns ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seul le service role peut accéder.
