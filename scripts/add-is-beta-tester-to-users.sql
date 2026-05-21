-- Migration : ajouter la colonne `is_beta_tester` sur la table `users`.
-- Utilisée pour identifier les comptes créés via l'ajout en masse (cohortes
-- bootcamp / bêta-testeurs invités manuellement par un admin).
--
-- Idempotent : peut être rejoué sans effet de bord.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.is_beta_tester IS
    'TRUE pour les utilisateurs importés en masse par un admin (cohortes / bêta-testeurs).';

CREATE INDEX IF NOT EXISTS users_is_beta_tester_idx
    ON public.users (is_beta_tester)
    WHERE is_beta_tester = TRUE;
