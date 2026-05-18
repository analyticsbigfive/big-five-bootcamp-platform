-- =============================================================================
-- Migration : index unique sur keynote_registrations.email
-- =============================================================================
-- Empêche les doublons d'inscription pour un même email. Combiné au check
-- applicatif dans /api/keynote/register, fait office de filet de sécurité
-- contre les races (deux inscriptions concurrentes avec même email).
--
-- Comparaison case-insensitive : on indexe `lower(email)` plutôt qu'`email`,
-- afin que "Jhouedanou@Gmail.com" et "jhouedanou@gmail.com" soient considérés
-- identiques.
--
-- À exécuter dans Supabase SQL Editor.
-- Si des doublons existent déjà, la création de l'index échouera : nettoyer
-- d'abord avec le SELECT ci-dessous.
-- =============================================================================

-- 1. Détecter les doublons éventuels avant la migration
--    (à exécuter manuellement, puis fusionner / supprimer si non-vide).
-- SELECT lower(email) AS email_norm, COUNT(*)
-- FROM public.keynote_registrations
-- GROUP BY lower(email)
-- HAVING COUNT(*) > 1;

-- 2. Créer l'index unique case-insensitive
CREATE UNIQUE INDEX IF NOT EXISTS keynote_registrations_email_unique
  ON public.keynote_registrations (lower(email));

COMMENT ON INDEX public.keynote_registrations_email_unique IS
  'Empêche les doublons d''inscription keynote pour un même email (case-insensitive).';
