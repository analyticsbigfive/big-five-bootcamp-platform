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
  isPromoCodeFormatValid,
  normalizePromoCode,
} from '@/lib/promo-codes';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

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
    const { userEmail, userName, plan, billing, phoneNumber, provider, currency = 'XOF', promoCode } = body;

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
    // Code promo LAVEIYE — valide UNIQUEMENT pour le plan Basic
    // Override : prix = 10 000 FCFA, durée = 90 jours
    // ——————————————————————————————————————————————————
    let promoApplied: { code: string; registrationId: string } | null = null;
    const normalizedPromo = normalizePromoCode(promoCode);

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
      const { data: regRow } = await supabaseAdmin
        .from('keynote_registrations')
        .select('id, promo_code, promo_redeemed_at')
        .eq('promo_code', normalizedPromo)
        .maybeSingle();

      if (!regRow) {
        return NextResponse.json({ error: 'Code promo introuvable' }, { status: 404 });
      }
      if ((regRow as any).promo_redeemed_at) {
        return NextResponse.json({ error: 'Ce code a déjà été utilisé' }, { status: 409 });
      }
      if (planKey !== KEYNOTE_PROMO_OFFER.plan) {
        return NextResponse.json(
          { error: `Ce code promo est réservé au plan ${KEYNOTE_PROMO_OFFER.planLabel}` },
          { status: 400 }
        );
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

      promoApplied = { code: normalizedPromo, registrationId: (regRow as any).id };
    }

    const SUBSCRIPTION_PRICE = promoApplied
      ? KEYNOTE_PROMO_OFFER.price
      : (isAnnual ? planConfig.annualPrice : planConfig.price);
    const durationDays = promoApplied
      ? KEYNOTE_PROMO_OFFER.durationDays
      : (isAnnual ? ANNUAL_SUBSCRIPTION_DURATION_DAYS : SUBSCRIPTION_DURATION_DAYS);
    const billingLabel = promoApplied
      ? KEYNOTE_PROMO_OFFER.durationLabel
      : (isAnnual ? '1 an' : '1 mois');

    // Verifier si l'utilisateur existe
    let { data: existingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, subscription_status, subscription_end_date, plan')
      .eq('email', userEmail)
      .single();

    // Si l'utilisateur n'existe pas, le creer
    if (!existingUser || userError?.code === 'PGRST116') {
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
    // Downgrade : autorisé UNIQUEMENT dans la fenêtre de renouvellement
    // (≤ RENEWAL_WINDOW_DAYS avant la fin) ou si l'abonnement est déjà
    // expiré. En dehors de cette fenêtre, on bloque pour ne pas faire
    // perdre à l'utilisateur les jours déjà payés au tarif supérieur.
    // ——————————————————————————————————————————————————
    if (isCurrentlyActive) {
      const currentRank = planRank((existingUser as any).plan);
      const targetRank = planRank(planConfig.dbKey);
      if (targetRank < currentRank) {
        const daysUntilEnd = Math.ceil(
          (currentEndDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const inRenewalWindow = daysUntilEnd <= RENEWAL_WINDOW_DAYS;
        if (!inRenewalWindow) {
          return NextResponse.json(
            {
              error: `Vous êtes déjà abonné à un plan supérieur (${(existingUser as any).plan}). Le downgrade vers ${planConfig.label} sera possible à partir du renouvellement (${RENEWAL_WINDOW_DAYS} jours avant l'expiration). Votre abonnement actuel expire le ${currentEndDate!.toLocaleDateString('fr-FR')}.`,
              renewableFrom: new Date(
                currentEndDate!.getTime() - RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
              ).toISOString(),
              currentEndDate: currentEndDate!.toISOString(),
            },
            { status: 403 }
          );
        }
      }
    }

    const baseDate = isCurrentlyActive ? currentEndDate : now;
    const subscriptionEndDate = new Date(baseDate!);
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + durationDays);

    const ref_command = generateRefCommand('SUB');
    const customerName = userName || (existingUser as any).name || userEmail.split('@')[0];

    const customerMessage = (isCurrentlyActive
      ? `Renouv ${planConfig.label}`
      : `Abo ${planConfig.label}`
    ).slice(0, 22); // PawaPay : max 22 chars

    // Creer le paiement dans la base
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
        billing: promoApplied ? 'promo3m' : (isAnnual ? 'annual' : 'monthly'),
        renewal: isCurrentlyActive,
        duration_days: durationDays,
        subscription_end_date: subscriptionEndDate.toISOString(),
        previous_end_date: isCurrentlyActive ? currentEndDate!.toISOString() : null,
        item_name: promoApplied
          ? `Offre LAVEIYE — ${planConfig.label} ${billingLabel}`
          : (isCurrentlyActive
              ? `Renouvellement Laveiye ${planConfig.label} - ${billingLabel}`
              : `Abonnement Laveiye ${planConfig.label} - ${billingLabel}`),
        customer_name: customerName,
        userId: (existingUser as any).id,
        promo_code: promoApplied?.code || null,
        promo_registration_id: promoApplied?.registrationId || null,
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
          { billing: promoApplied ? 'promo3m' : (isAnnual ? 'annual' : 'monthly') },
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
      billing: promoApplied ? 'promo3m' : (isAnnual ? 'annual' : 'monthly'),
      duration_days: durationDays,
      subscription_end_date: subscriptionEndDate.toISOString(),
      renewal: isCurrentlyActive,
      promo_code: promoApplied?.code || null,
    });

  } catch (error) {
    console.error('Subscription payment error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
