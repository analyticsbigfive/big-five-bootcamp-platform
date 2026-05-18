-- ============================================================
-- BigFiveDecrypte sessions
-- Permet a l'admin de definir les seances mensuelles avec
-- date, campagnes a decrypter, lien de reunion, etc.
-- L'utilisateur Pro choisit une seance ouverte au moment de
-- son inscription (decrypte_registrations.session_id).
-- Date: 2026-05-15
-- ============================================================

CREATE TABLE IF NOT EXISTS public.decrypte_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    -- Date/heure programmee de la seance (timezone aware)
    scheduled_at    timestamptz,
    -- Tag mois lisible/exportable (YYYY-MM). Auto-derive du scheduled_at si fourni.
    session_month   text NOT NULL DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM'),
    -- Lien de reunion (Zoom / Meet / Teams)
    meeting_url     text,
    -- Capacite optionnelle. NULL = illimite.
    max_seats       int,
    -- Etat : draft (cache), open (visible et ouvert), closed (visible mais ferme), archived
    status          text NOT NULL DEFAULT 'draft',
    -- Liste des UUID de campagnes (public.campaigns.id) a decrypter pendant la seance.
    -- On ne pose pas de FK array (Postgres ne supporte pas) ; integrite verifiee cote API.
    campaign_ids    uuid[] NOT NULL DEFAULT '{}',
    -- Snapshot des titres pour archivage / affichage rapide
    campaign_titles text[] NOT NULL DEFAULT '{}',
    notes           text,
    created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT decrypte_sessions_status_chk
        CHECK (status IN ('draft', 'open', 'closed', 'archived'))
);

CREATE INDEX IF NOT EXISTS decrypte_sessions_status_idx
    ON public.decrypte_sessions (status, scheduled_at);
CREATE INDEX IF NOT EXISTS decrypte_sessions_month_idx
    ON public.decrypte_sessions (session_month);

ALTER TABLE public.decrypte_sessions ENABLE ROW LEVEL SECURITY;
-- Lecture publique des seances visibles (open / closed) pour l'UI utilisateur.
DROP POLICY IF EXISTS decrypte_sessions_select_visible
    ON public.decrypte_sessions;
CREATE POLICY decrypte_sessions_select_visible
    ON public.decrypte_sessions
    FOR SELECT
    USING (status IN ('open', 'closed'));

-- Service role (route admin) gere les ecritures.

-- Trigger updated_at (best effort : si la fonction n'existe pas, on l'ajoute)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decrypte_sessions_set_updated_at
    ON public.decrypte_sessions;
CREATE TRIGGER decrypte_sessions_set_updated_at
    BEFORE UPDATE ON public.decrypte_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Lien decrypte_registrations -> decrypte_sessions
-- ============================================================

ALTER TABLE public.decrypte_registrations
    ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.decrypte_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS decrypte_registrations_session_id_idx
    ON public.decrypte_registrations (session_id);

-- Anti-doublon : un utilisateur ne s'inscrit qu'une fois par session_id.
-- L'ancien index (user_id, session_month) est conserve pour la compatibilite des
-- inscriptions historiques sans session_id.
CREATE UNIQUE INDEX IF NOT EXISTS decrypte_registrations_user_session_key
    ON public.decrypte_registrations (user_id, session_id)
    WHERE user_id IS NOT NULL AND session_id IS NOT NULL;
