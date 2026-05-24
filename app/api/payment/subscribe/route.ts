/**
 * API Route: POST /api/payment/subscribe
 *
 * Cree une demande de paiement PawaPay pour un abonnement.
 * Plans supportés : Découverte (1 000 XOF), Basic (4 900 XOF), Pro (9 900 XOF).
 * Supporte le renouvellement anticipé : les jours restants sont conservés.
 *
 * Body:
 * - userEmail    : Email de l'utilisateur
 * - userName?    : Nom de l'utilisateur
 * - plan         : "discovery" | "basic" | "pro"
 * - billing      : "monthly" | "annual"
 * - phoneNumber  : MSISDN du client (ex. "2250707123456")
 * - provider     : Code provider PawaPay (ex. "ORANGE_CIV", "MTN_MOMO_CIV", "MOOV_CIV" — Wave non supporté)
 * - currency?    : Devise (defaut "XOF")
 * - promoCode?   : Code promo (ex. KEYNOTE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  initiateDeposit,
  generateRefCommand,
  getReturnUrl,
  getFailedUrl,
  checkDepositStatus,
} from '@/lib/pawapay';
import {
  KEYNOTE_PROMO_OFFER,
  computePromoPhases,
  isPromoCodeFormatValid,
  normalizePromoCode,
  type PromoPhases,
} from '@/lib/promo-codes';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { addDays, computeSubscriptionEnd } from '@/lib/subscription';

const PLAN_PRICES: Record<string, { price: number; annualPrice: number; label: string; dbKey: string }> = {
  discovery: { price: 1000, annualPrice: 10000, label: 'Découverte', dbKey: 'Discovery' },
  basic: { price: 4900, annualPrice: 49000, label: 'Basic', dbKey: 'Basic' },
  pro: { price: 9900, annualPrice: 99000, label: 'Pro', dbKey: 'Pro' },
};

const SUBSCRIPTION_DURATION_DAYS = 30;
const ANNUAL_SUBSCRIPTION_DURATION_DAYS = 365;

/**
 * Fenêtre de renouvellement (en jours avant `subscription_end_date`).
 * À l'intérieur de cette fenêtre, l'utilisateur peut souscrire à un plan
 * inférieur (downgrade). En dehors, le downgrade reste bloqué pour éviter
 * que l'utilisateur ne perde inutilement des jours déjà payés.
 */
const RENEWAL_WINDOW_DAYS = 7;

/**
 * Rang d'un plan pour interdire les downgrades quand l'abonnement
 * est encore actif. Le tier "Free" a été déprécié. Découverte < Basic < Pro.
 */
const PLAN_RANK: Record<string, number> = {
  discovery: 1,
  basic: 2,
  pro: 3,
};

function planRank(dbKeyOrSlug: string | null | undefined): number {
  if (!dbKeyOrSlug) return 0;
  return PLAN_RANK[String(dbKeyOrSlug).toLowerCase()] ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    // Auth obligatoire : l'utilisateur doit être connecté et ne peut souscrire
    // que pour son propre compte. Empêche un attaquant d'initier un paiement
    // pour un autre email ou de consommer un code promo unique au nom d'autrui.
    const { getSupabaseServer } = await import('@/lib/supabase-server');
    const supabaseServer = await getSupabaseServer();
    const { data: { user: authUser } } = await supabaseServer.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await request.json();
    const { userEmail, userName, plan, billing, phoneNumber, provider, currency = 'XOF', promoCode, rawPromoInput } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    // Le userEmail soumis doit correspondre à la session — pas de souscription
    // pour un compte tiers.
    if ((userEmail || '').toLowerCase().trim() !== (authUser.email || '').toLowerCase().trim()) {
      return NextResponse.json(
        { error: "Email ne correspond pas à la session authentifiée." },
        { status: 403 }
      );
    }

    if (!phoneNumber || !provider) {
      return NextResponse.json(
        { error: 'phoneNumber et provider sont requis (ex. provider: "ORANGE_CIV").' },
        { status: 400 }
      );
    }

    // Plan strict — aucun fallback silencieux vers Pro.
    // Le client DOIT envoyer un plan valide ("discovery" | "basic" | "pro").
    const planKey = String(plan || '').toLowerCase().trim();
    const planConfig = PLAN_PRICES[planKey];
    const isAnnual = billing === 'annual';

    if (!planConfig) {
      return NextResponse.json(
        { error: 'Plan invalide. Choisissez "discovery", "basic" ou "pro".' },
        { status: 400 }
      );
    }

    // ——————————————————————————————————————————————————
    // Code promo LAVEIYE — BONUS "3 mois Basic offerts" cumulable avec
    // n'importe quel plan. Les phases (avant/après/mergé) sont calculées
    // ici puis appliquées à l'activation par le callback PawaPay.
    // ————————————————————————————————————————————————
    let promoApplied: { code: string; registrationId: string; phases: PromoPhases } | null = null;
    const normalizedPromo = normalizePromoCode(promoCode);
    // Fix 2 — détecter si un code brut a été envoyé sans avoir été appliqué côté client
    if (!normalizedPromo && rawPromoInput) {
      console.warn(`[subscribe] promoCode absent mais rawPromoInput="${rawPromoInput}" pour ${userEmail} — code non appliqué côté client`);
    }

    if (normalizedPromo) {
      // Rate-limit : 5 tentatives / 5 min par (IP + email) pour bloquer le
      // brute-force sur les codes promo.
      const ip = getClientIp(request);
      const rl = rateLimit(`promo:${ip}:${(userEmail || '').toLowerCase()}`, 5, 5 * 60_000);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
          { status: 429 }
        );
      }
      if (!isPromoCodeFormatValid(normalizedPromo)) {
        return NextResponse.json(
          { error: 'Code promo invalide (format attendu : LAVEIYE-XXXX)' },
          { status: 400 }
        );
      }
      // Validation par couple (code, email) — le code seul ne suffit pas :
      // l'email connecté DOIT correspondre à celui de l'inscription keynote
      // qui a reçu le code. Empêche un tiers d'utiliser un code intercepté.
      const promoEmail = (userEmail || '').toLowerCase().trim();
      const { data: regRow } = await supabaseAdmin
        .from('keynote_registrations')
        .select('id, email, promo_code, promo_redeemed_at, promo_status')
        .eq('promo_code', normalizedPromo)
        .eq('email', promoEmail)
        .maybeSingle();

      if (!regRow) {
        return NextResponse.json(
          { error: 'Code promo invalide ou email ne correspondant pas à celui qui a reçu le code.' },
          { status: 404 }
        );
      }
      // promo_status = source de vérité (fallback promo_redeemed_at pour les
      // lignes antérieures à la migration promo-status).
      const regStatus = (regRow as any).promo_status as string | null | undefined;
      if (regStatus === 'expired') {
        return NextResponse.json({ error: 'Ce code promo a expiré' }, { status: 410 });
      }
      if (regStatus === 'used' || (regRow as any).promo_redeemed_at) {
        return NextResponse.json({ error: 'Ce code a déjà été utilisé' }, { status: 409 });
      }

      // Empêcher l'utilisation concurrente : refuser si un paiement
      // est déjà en attente (pending/processing) avec le même code.
      const { data: pendingPayments } = await supabaseAdmin
        .from('payments')
        .select('id, status, created_at')
        .eq('promo_code', normalizedPromo)
        .in('status', ['pending', 'processing']);

      if (pendingPayments && pendingPayments.length > 0) {
        return NextResponse.json(
          { error: 'Ce code est en cours d\'utilisation par un autre paiement. Réessayez dans quelques minutes.' },
          { status: 409 }
        );
      }

      // Calcul des phases selon le plan choisi par l'utilisateur.
      const planDurationDaysForPromo = isAnnual
        ? ANNUAL_SUBSCRIPTION_DURATION_DAYS
        : SUBSCRIPTION_DURATION_DAYS;
      const phases = computePromoPhases(planKey, planDurationDaysForPromo);

      promoApplied = {
        code: normalizedPromo,
        registrationId: (regRow as any).id,
        phases,
      };
    }

    // Prix : strictement celui du plan choisi. Le bonus LAVEIYE est gratuit.
    const SUBSCRIPTION_PRICE = isAnnual ? planConfig.annualPrice : planConfig.price;
    // Durée de la PREMIÈRE phase d'accès :
    // - sans promo : durée standard du billing choisi
    // - avec promo : firstDurationDays calculé par computePromoPhases
    //   (ex. "before" Discovery → 90 j Basic ; "merged" Basic → plan+90 j ; "after" Pro → durée plan)
    const durationDays = promoApplied
      ? promoApplied.phases.firstDurationDays
      : (isAnnual ? ANNUAL_SUBSCRIPTION_DURATION_DAYS : SUBSCRIPTION_DURATION_DAYS);
    const billingLabel = isAnnual ? '1 an' : '1 mois';

    // Verifier si l'utilisateur existe
    let { data: existingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, subscription_status, subscription_end_date, plan, pending_plan, pending_plan_starts_at')
      .eq('email', userEmail)
      .single();

    // Erreur DB inattendue (schema manquant, colonne inconnue…) — ne pas tenter
    // d'upsert car cela pourrait écraser le plan de l'utilisateur avec 'Discovery'.
    if (userError && userError.code !== 'PGRST116') {
      console.error('[subscribe] user lookup error:', userError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du profil utilisateur.', details: userError.message },
        { status: 500 }
      );
    }

    // Si l'utilisateur n'existe pas (PGRST116 = no row), le créer
    if (!existingUser) {
      const { data: authListData } = await supabaseAdmin.auth.admin.listUsers() as any;
      const authUser = authListData?.users?.find((u: any) => u.email === userEmail);

      if (!authUser) {
        return NextResponse.json(
          { error: 'Utilisateur non trouve. Veuillez vous inscrire d\'abord.' },
          { status: 404 }
        );
      }

      const { data: newUser, error: createError } = await (supabaseAdmin as any)
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
          role: 'user',
          plan: 'Discovery',
          status: 'active',
        }, { onConflict: 'id' })
        .select('id, email, name, subscription_status, subscription_end_date, plan')
        .single();

      if (createError) {
        return NextResponse.json(
          { error: 'Impossible de creer le profil utilisateur', details: createError.message },
          { status: 500 }
        );
      }

      existingUser = newUser;
    }

    // Calculer la date de fin
    const now = new Date();
    const currentEndDate = (existingUser as any).subscription_end_date
      ? new Date((existingUser as any).subscription_end_date)
      : null;

    const isCurrentlyActive = (existingUser as any).subscription_status === 'active'
      && currentEndDate
      && currentEndDate > now;

    // ——————————————————————————————————————————————————
    // Downgrade différé : le user paie maintenant un plan inférieur, mais son
    // plan actuel reste actif jusqu'à `subscription_end_date`. À cette date,
    // un cron applique le `pending_plan` et démarre la durée achetée.
    //
    // - Si downgrade : on flag `is_downgrade=true`, on stocke `pending_starts_at`
    //   (= currentEndDate) et on n'étend PAS l'abonnement courant.
    // - Si même plan ou upgrade : comportement historique (renouvellement /
    //   extension à partir de currentEndDate, ou démarrage immédiat).
    // - Si un downgrade est déjà en attente : refus pour éviter d'écraser.
    // ——————————————————————————————————————————————————
    // Promo + abonnement déjà actif = combinaison non supportée pour MVP
    // (compliquerait la fusion des phases avec le restant du plan en cours).
    // L'utilisateur doit consommer son code après expiration.
    if (promoApplied && (existingUser as any).subscription_status === 'active') {
      const endDate = (existingUser as any).subscription_end_date
        ? new Date((existingUser as any).subscription_end_date)
        : null;
      if (endDate && endDate > new Date()) {
        return NextResponse.json(
          {
            error: "Le code promo n'est utilisable qu'à la souscription initiale. Votre abonnement actuel est encore actif jusqu'au " +
              endDate.toLocaleDateString('fr-FR') + '.',
          },
          { status: 409 }
        );
      }
    }

    let isDowngrade = false;
    let pendingStartsAt: Date | null = null;

    if (isCurrentlyActive) {
      const currentRank = planRank((existingUser as any).plan);
      const targetRank = planRank(planConfig.dbKey);
      if (targetRank < currentRank) {
        isDowngrade = true;
        pendingStartsAt = currentEndDate;

        // Bloquer si un downgrade est déjà programmé (pour éviter empilement).
        if ((existingUser as any).pending_plan) {
          return NextResponse.json(
            {
              error: `Un changement de plan est déjà programmé (${(existingUser as any).pending_plan}) pour le ${new Date((existingUser as any).pending_plan_starts_at).toLocaleDateString('fr-FR')}. Annulez-le ou attendez son application avant d'en programmer un autre.`,
              pendingPlan: (existingUser as any).pending_plan,
              pendingStartsAt: (existingUser as any).pending_plan_starts_at,
            },
            { status: 409 }
          );
        }
      }
    }

    // Pour un downgrade différé : la durée s'applique à partir de la date
    // d'activation différée, pas du moment du paiement. Pour les autres cas,
    // logique historique (extension depuis currentEndDate si actif, sinon now).
    const baseDate = isDowngrade
      ? pendingStartsAt!
      : (isCurrentlyActive ? currentEndDate : now);
    // Calendaire pour un abonnement standard (mensuel = longueur réelle du mois,
    // annuel = 1 an) ; durée explicite en jours pour les phases promo.
    const subscriptionEndDate = promoApplied
      ? addDays(baseDate!, durationDays)
      : computeSubscriptionEnd(baseDate!, { billing: isAnnual ? 'annual' : 'monthly' });

    const ref_command = generateRefCommand('SUB');
    const customerName = userName || (existingUser as any).name || userEmail.split('@')[0];

    const customerMessage = (isCurrentlyActive
      ? `Renouv ${planConfig.label}`
      : `Abo ${planConfig.label}`
    ).slice(0, 22); // PawaPay : max 22 chars

    // Creer le paiement dans la base
    // Plan effectivement servi en PREMIÈRE phase (peut différer du planKey
    // acheté quand un promo est appliqué : ex. Discovery acheté → phase 1 = Basic).
    const firstPhasePlanDbKey = promoApplied
      ? promoApplied.phases.firstPlan // 'Basic' | 'Pro'
      : planConfig.dbKey;

    const paymentInsert = {
      user_email: userEmail,
      amount: SUBSCRIPTION_PRICE,
      currency,
      status: 'pending',
      payment_method: 'pawapay',
      provider,
      client_phone: phoneNumber,
      ref_command,
      metadata: {
        type: 'subscription',
        plan: planKey,
        plan_label: planConfig.label,
        plan_db_key: planConfig.dbKey,
        billing: isAnnual ? 'annual' : 'monthly',
        renewal: isCurrentlyActive,
        is_downgrade: isDowngrade,
        pending_starts_at: isDowngrade ? pendingStartsAt!.toISOString() : null,
        duration_days: durationDays,
        subscription_end_date: subscriptionEndDate.toISOString(),
        previous_end_date: isCurrentlyActive ? currentEndDate!.toISOString() : null,
        item_name: promoApplied
          ? `Abonnement Laveiye ${planConfig.label} ${billingLabel} + bonus LAVEIYE`
          : (isCurrentlyActive
              ? `Renouvellement Laveiye ${planConfig.label} - ${billingLabel}`
              : `Abonnement Laveiye ${planConfig.label} - ${billingLabel}`),
        customer_name: customerName,
        userId: (existingUser as any).id,
        promo_code: promoApplied?.code || null,
        promo_registration_id: promoApplied?.registrationId || null,
        // Bonus LAVEIYE : phases d'abonnement à dérouler dans le callback.
        // - first_phase_plan : plan effectivement servi immédiatement
        // - bonus_phase      : phase supplémentaire à placer en pending (si !merged)
        promo_bonus: promoApplied
          ? {
              label: KEYNOTE_PROMO_OFFER.label,
              kind: promoApplied.phases.kind,
              first_phase_plan: firstPhasePlanDbKey,
              first_phase_duration_days: promoApplied.phases.firstDurationDays,
              bonus_phase:
                promoApplied.phases.kind === 'merged'
                  ? null
                  : {
                      plan:
                        promoApplied.phases.kind === 'before'
                          ? promoApplied.phases.secondPlan
                          : promoApplied.phases.secondPlan,
                      duration_days:
                        promoApplied.phases.kind === 'before'
                          ? promoApplied.phases.secondDurationDays
                          : promoApplied.phases.secondDurationDays,
                      billing: isAnnual ? 'annual' : 'monthly',
                    },
            }
          : null,
      },
    };

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert(paymentInsert as any)
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment record', details: paymentError.message },
        { status: 500 }
      );
    }

    // Initier le depot PawaPay
    let pawapayResponse;
    try {
      pawapayResponse = await initiateDeposit({
        depositId: ref_command,
        amount: String(SUBSCRIPTION_PRICE),
        currency,
        payer: {
          type: 'MMO',
          accountDetails: { phoneNumber, provider },
        },
        customerMessage,
        successfulUrl: getReturnUrl(ref_command),
        failedUrl: getFailedUrl(ref_command),
        metadata: [
          { ref_command },
          { type: 'subscription' },
          { plan: planKey },
          { billing: isAnnual ? 'annual' : 'monthly' },
          { user_id: String((existingUser as any).id) },
          { renewal: isCurrentlyActive ? 'true' : 'false' },
          ...(promoApplied ? [{ promo_code: promoApplied.code }] : []),
        ],
      });
    } catch (pawapayError) {
      console.error('PawaPay initialization error:', pawapayError);

      await (supabaseAdmin as any)
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', (payment as any).id);

      const errorMsg = pawapayError instanceof Error ? pawapayError.message : 'Erreur PawaPay';
      return NextResponse.json(
        { error: 'Le service de paiement est temporairement indisponible. Veuillez reessayer.', details: errorMsg },
        { status: 502 }
      );
    }

    // Si REJECTED, marquer le paiement et retourner l'erreur
    if (pawapayResponse.status === 'REJECTED') {
      await (supabaseAdmin as any)
        .from('payments')
        .update({
          status: 'rejected',
          failure_code: pawapayResponse.failureReason?.failureCode,
          failure_message: pawapayResponse.failureReason?.failureMessage,
        })
        .eq('id', (payment as any).id);

      return NextResponse.json(
        {
          success: false,
          error: 'Paiement rejete par PawaPay',
          failureReason: pawapayResponse.failureReason,
        },
        { status: 400 }
      );
    }

    // Flow avec redirection (Wave SEN/CIV) : attendre que l'URL d'auth soit disponible
    let authorizationUrl: string | undefined;
    if (pawapayResponse.nextStep === 'GET_AUTH_URL') {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const check = await checkDepositStatus(ref_command);
          if (check.data?.authorizationUrl) {
            authorizationUrl = check.data.authorizationUrl;
            break;
          }
        } catch {
          // ignorer, le frontend pourra poller
        }
      }
    }

    return NextResponse.json({
      success: true,
      payment_id: (payment as any).id,
      ref_command,
      depositId: ref_command,
      status: pawapayResponse.status,
      nextStep: pawapayResponse.nextStep,
      // Si on a une URL d'auth (Wave SEN/CIV), on la propose comme redirect_url
      redirect_url: authorizationUrl,
      authorizationUrl,
      // Sinon le frontend affiche "verifiez votre telephone" et polle cet endpoint
      pollingUrl: `/api/payment/pawapay/status/deposit/${ref_command}`,
      amount: SUBSCRIPTION_PRICE,
      currency,
      plan: planKey,
      plan_label: planConfig.label,
      billing: isAnnual ? 'annual' : 'monthly',
      duration_days: durationDays,
      subscription_end_date: subscriptionEndDate.toISOString(),
      renewal: isCurrentlyActive,
      promo_code: promoApplied?.code || null,
      promo_bonus_label: promoApplied ? KEYNOTE_PROMO_OFFER.label : null,
    });

  } catch (error) {
    console.error('Subscription payment error:', error);
    const devMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Internal server error',
        // En prod : pas de fuite. En dev : on garde pour debug.
        ...(process.env.NODE_ENV !== 'production' ? { message: devMessage } : {}),
      },
      { status: 500 }
    );
  }
}
