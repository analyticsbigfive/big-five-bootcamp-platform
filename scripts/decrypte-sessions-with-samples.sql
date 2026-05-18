-- ============================================================
-- BigFiveDecrypte sessions - Migration COMPLÈTE + données test
-- Copie le contenu complet et execute dans Supabase SQL Editor
-- ============================================================

-- 1. Créer la table decrypte_sessions
CREATE TABLE IF NOT EXISTS public.decrypte_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    scheduled_at    timestamptz,
    session_month   text NOT NULL DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM'),
    meeting_url     text,
    max_seats       int,
    status          text NOT NULL DEFAULT 'draft',
    campaign_ids    uuid[] NOT NULL DEFAULT '{}',
    campaign_titles text[] NOT NULL DEFAULT '{}',
    notes           text,
    created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT decrypte_sessions_status_chk
        CHECK (status IN ('draft', 'open', 'closed', 'archived'))
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS decrypte_sessions_status_idx
    ON public.decrypte_sessions (status, scheduled_at);
CREATE INDEX IF NOT EXISTS decrypte_sessions_month_idx
    ON public.decrypte_sessions (session_month);

-- 3. RLS
ALTER TABLE public.decrypte_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decrypte_sessions_select_visible
    ON public.decrypte_sessions;
CREATE POLICY decrypte_sessions_select_visible
    ON public.decrypte_sessions
    FOR SELECT
    USING (status IN ('open', 'closed'));

-- 4. Trigger updated_at
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

-- 5. Ajouter colonne session_id à decrypte_registrations (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'decrypte_registrations'
  ) THEN
    ALTER TABLE public.decrypte_registrations
      ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.decrypte_sessions(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS decrypte_registrations_session_id_idx
      ON public.decrypte_registrations (session_id);

    CREATE UNIQUE INDEX IF NOT EXISTS decrypte_registrations_user_session_key
      ON public.decrypte_registrations (user_id, session_id)
      WHERE user_id IS NOT NULL AND session_id IS NOT NULL;
    
    RAISE NOTICE 'Colonne session_id ajoutée à decrypte_registrations ✓';
  ELSE
    RAISE WARNING 'Table decrypte_registrations non trouvée. Exécute d''abord scripts/bigfive-decrypte-registrations.sql';
  END IF;
END $$;

-- ============================================================
-- DONNÉES DE TEST : 3 sessions de décryptage (sans dépendance campaigns)
-- ============================================================

INSERT INTO public.decrypte_sessions 
  (title, description, scheduled_at, session_month, meeting_url, max_seats, status, campaign_ids, campaign_titles, notes)
VALUES
  (
    'Décrypte #1 - Mai 2026',
    'Première session du mois : décryptage des meilleures campagnes de marketing digital. Animée par l''équipe Big Five.',
    now() + interval '5 days 14:00',
    '2026-05',
    'https://zoom.us/j/meeting1',
    25,
    'open',
    '{}',
    '{}',
    'Session 1 - places disponibles'
  ),
  (
    'Décrypte #2 - Juin 2026',
    'Deuxième session : focus sur les réseaux sociaux et l''engagement. Avec cas pratiques.',
    now() + interval '35 days 14:00',
    '2026-06',
    'https://zoom.us/j/meeting2',
    30,
    'open',
    '{}',
    '{}',
    'Session 2 - places disponibles'
  ),
  (
    'Décrypte #3 - Juillet 2026',
    'Troisième session : tendances émergentes et innovation marketing.',
    now() + interval '65 days 14:00',
    '2026-07',
    'https://zoom.us/j/meeting3',
    20,
    'draft',
    '{}',
    '{}',
    'Session 3 - à confirmer'
  );

SELECT 'Migration terminée ✓' as status;
SELECT COUNT(*) as sessions_creees FROM public.decrypte_sessions;
SELECT * FROM public.decrypte_sessions ORDER BY scheduled_at;
