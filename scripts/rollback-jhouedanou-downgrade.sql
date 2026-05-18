-- =============================================================================
-- ROLLBACK : downgrade involontaire jhouedanou@gmail.com (Basic -> Discovery)
-- =============================================================================
-- Contexte : bug dans /api/payment/check/[ref_command] qui ne respectait pas
-- la logique downgrade différé. Le paiement Discovery a écrasé direct le plan
-- Basic au lieu d'écrire pending_plan.
--
-- Procédure : on remonte le dernier payment 'subscription' completed de type
-- "discovery" pour cet email, on récupère les métadonnées, on restaure le plan
-- Basic (avec son ancien subscription_end_date stocké dans metadata.previous_end_date)
-- et on programme pending_plan = Discovery pour la bonne date.
--
-- À exécuter dans Supabase SQL Editor APRÈS avoir appliqué
-- scripts/pending-plan-downgrade.sql.
-- =============================================================================

DO $$
DECLARE
  v_user_id            uuid;
  v_payment_metadata   jsonb;
  v_previous_end       timestamptz;
  v_duration_days      int;
  v_billing            text;
BEGIN
  -- 1. Trouver le user
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'jhouedanou@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jhouedanou@gmail.com introuvable';
  END IF;

  -- 2. Récupérer le DERNIER paiement subscription completed pour ce user
  SELECT metadata INTO v_payment_metadata
  FROM public.payments
  WHERE user_email = 'jhouedanou@gmail.com'
    AND status = 'completed'
    AND metadata->>'type' = 'subscription'
    AND metadata->>'plan' = 'discovery'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment_metadata IS NULL THEN
    RAISE EXCEPTION 'Aucun paiement Discovery completed trouvé pour jhouedanou@gmail.com';
  END IF;

  v_previous_end  := (v_payment_metadata->>'previous_end_date')::timestamptz;
  v_duration_days := COALESCE((v_payment_metadata->>'duration_days')::int, 30);
  v_billing       := COALESCE(v_payment_metadata->>'billing', 'monthly');

  IF v_previous_end IS NULL THEN
    RAISE EXCEPTION 'metadata.previous_end_date manquante — rollback manuel requis';
  END IF;

  -- 3. Restaurer Basic actif + programmer Discovery en pending
  UPDATE public.users
  SET
    plan                    = 'Basic',
    subscription_status     = 'active',
    subscription_end_date   = v_previous_end,
    pending_plan            = 'Discovery',
    pending_plan_starts_at  = v_previous_end,
    pending_billing         = v_billing,
    pending_duration_days   = v_duration_days,
    updated_at              = now()
  WHERE id = v_user_id;

  RAISE NOTICE 'Rollback OK : plan=Basic actif jusqu''au %, pending=Discovery (% jours) à partir de la même date',
    v_previous_end, v_duration_days;
END $$;

-- Vérification
SELECT
  email, plan, subscription_status, subscription_end_date,
  pending_plan, pending_plan_starts_at, pending_duration_days, pending_billing
FROM public.users
WHERE email = 'jhouedanou@gmail.com';
