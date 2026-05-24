/**
 * Callback URL : POST /api/payment/pawapay/callback/deposit
 *
 * Reçoit les callbacks PawaPay pour les dépôts (collectes de paiement).
 * Doc : https://docs.pawapay.io/v2/docs/what_to_know#callbacks
 *
 * Règles :
 *   - Endpoint idempotent (PawaPay peut renvoyer plusieurs fois le même callback)
 *   - Toujours retourner HTTP 200 OK (sinon PawaPay réessaiera pendant 15 min)
 *   - Aucune authentification applicative — whitelist par IP optionnelle
 *
 * URL à déclarer dans le Dashboard PawaPay :
 *   {PUBLIC_BASE_URL}/api/payment/pawapay/callback/deposit
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isAllowedPawaPayIP,
  checkDepositStatus,
  type PawaPayDepositCallback,
} from '@/lib/pawapay'
import {
  notifyPaymentSuccess,
  notifyPromoCodeRedeemed,
} from '@/lib/notifications'

// PawaPay doit pouvoir accéder à cette route sans auth. On désactive aussi
// le cache et on force un rendu dynamique pour ne rien louper.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 1. Vérification IP (obligatoire en production, cf. isAllowedPawaPayIP).
    // On renvoie 401 — PawaPay réessaiera depuis la bonne IP si problème
    // réseau, mais un acteur tiers sera bloqué.
    if (!isAllowedPawaPayIP(request)) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`⚠️ PawaPay deposit callback IP refusée: ${ip}`)
      return new NextResponse('Unauthorized source', { status: 401 })
    }

    const payload = (await request.json()) as PawaPayDepositCallback

    console.log('📥 PawaPay deposit callback:', {
      depositId: payload.depositId,
      status: payload.status,
      amount: payload.amount,
      currency: payload.currency,
      provider: payload.payer?.accountDetails?.provider,
    })

    if (!payload.depositId) {
      // Payload invalide — on log mais on renvoie 200 pour ne pas retenter
      console.error('❌ deposit callback sans depositId', payload)
      return new NextResponse('OK', { status: 200 })
    }

    // 2. Récupérer le paiement (idempotence : on ne met à jour que si le statut change)
    const { data: payment, error: fetchError } = await (supabaseAdmin as any)
      .from('payments')
      .select('id, status, metadata, user_email, amount, currency, ref_command')
      .eq('ref_command', payload.depositId)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Supabase select payment error:', fetchError)
    }

    if (!payment) {
      console.warn(
        `⚠️ Aucun paiement trouvé pour depositId=${payload.depositId} — stockage d'un callback orphelin`
      )
      await storeOrphanCallback('deposit', payload)
      return new NextResponse('OK', { status: 200 })
    }

    // Idempotence : si déjà final, on ignore
    const finalStatuses = ['completed', 'failed', 'refunded', 'canceled']
    if (finalStatuses.includes(payment.status)) {
      console.log(
        `ℹ️ Paiement ${payload.depositId} déjà en statut final (${payment.status}), callback ignoré`
      )
      return new NextResponse('OK', { status: 200 })
    }

    // 3. SÉCURITÉ : les callbacks PawaPay ne sont pas signés. On ne fait
    // JAMAIS confiance au statut présent dans le corps de la requête — un
    // tiers qui atteindrait cet endpoint (ex. spoofing d'IP) pourrait sinon
    // forger un "COMPLETED" et s'offrir un abonnement gratuit. On revérifie
    // donc systématiquement le statut réel auprès de l'API PawaPay
    // authentifiée (Bearer token) avant tout effet de bord.
    let verified: PawaPayDepositCallback
    try {
      const result = await checkDepositStatus(payload.depositId)
      if (result.status === 'NOT_FOUND' || !result.data) {
        console.warn(
          `⚠️ deposit ${payload.depositId} introuvable chez PawaPay — callback ignoré`
        )
        return new NextResponse('OK', { status: 200 })
      }
      verified = result.data
    } catch (e) {
      // Échec de la vérification (réseau / token) : on n'active rien sur la
      // foi du body. Le polling /api/payment/check (qui vérifie aussi via
      // l'API) prendra le relais côté client.
      console.error('❌ Vérification PawaPay impossible, callback non appliqué:', e)
      return new NextResponse('OK', { status: 200 })
    }

    // 4. Mapping statut réel (vérifié) → statut interne
    const internalStatus = mapDepositStatus(verified.status)

    const { error: updateError } = await (supabaseAdmin as any)
      .from('payments')
      .update({
        status: internalStatus,
        payment_method: verified.payer?.accountDetails?.provider || 'pawapay',
        client_phone: verified.payer?.accountDetails?.phoneNumber || null,
        final_amount: verified.amount ? Number(verified.amount) : undefined,
        completed_at:
          internalStatus === 'completed' ? new Date().toISOString() : undefined,
        ipn_data: verified as any,
        provider_transaction_id: verified.providerTransactionId || null,
        failure_code: verified.failureReason?.failureCode || null,
        failure_message: verified.failureReason?.failureMessage || null,
        authorization_url: verified.authorizationUrl || null,
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('❌ Supabase update payment error:', updateError)
      // On renvoie 200 quand même — on pourra rejouer le callback manuellement
      return new NextResponse('OK', { status: 200 })
    }

    // 5. Side-effects métier lorsque le paiement est réellement complété
    if (verified.status === 'COMPLETED') {
      const metadata = (payment.metadata || {}) as any
      if (metadata.type === 'brand_request') {
        await activateBrandRequest(payment, verified)
      } else {
        await activateUserSubscription(payment)
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('❌ PawaPay deposit callback error:', error)
    // On renvoie 200 pour éviter les retries infinis sur une erreur de parsing
    return new NextResponse('OK', { status: 200 })
  }
}

// Doc : "Your endpoint needs to allow us to POST the callback."
// On ajoute GET/HEAD pour que PawaPay puisse tester l'URL depuis le dashboard.
export async function GET() {
  return NextResponse.json({ ok: true, kind: 'deposit' })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDepositStatus(status: PawaPayDepositCallback['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'FAILED':
      return 'failed'
    case 'REJECTED':
      return 'rejected'
    case 'PROCESSING':
    case 'ACCEPTED':
      return 'processing'
    case 'IN_RECONCILIATION':
      return 'in_reconciliation'
    case 'ENQUEUED':
      return 'enqueued'
    default:
      return 'pending'
  }
}

async function storeOrphanCallback(
  kind: 'deposit' | 'payout' | 'refund',
  payload: unknown
) {
  try {
    await (supabaseAdmin as any).from('pawapay_orphan_callbacks').insert({
      kind,
      payload: payload as any,
    })
  } catch (e) {
    // La table n'existe peut-être pas encore — on log seulement
    console.error('Could not persist orphan callback', e)
  }
}

async function activateUserSubscription(payment: {
  id: string
  amount?: number | null
  metadata?: any
}) {
  try {
    const metadata = payment.metadata || {}
    if (metadata.type !== 'subscription' || !metadata.userId) return

    // Plan strict — pas de fallback silencieux vers Pro.
    // Si la métadonnée est absente/invalide, on log et on n'active pas (sécurité).
    const rawPlan = String(metadata.plan || '').toLowerCase().trim()
    let planName: 'Discovery' | 'Basic' | 'Pro'
    if (rawPlan === 'basic') {
      planName = 'Basic'
    } else if (rawPlan === 'pro') {
      planName = 'Pro'
    } else if (rawPlan === 'discovery' || rawPlan === 'free') {
      planName = 'Discovery'
    } else {
      console.error(
        '[pawapay/deposit] Plan invalide ou manquant dans metadata, activation annul\u00e9e',
        { paymentId: payment.id, rawPlan, metadata }
      )
      return
    }

    // ——————————————————————————————————————————————————————————————
    // Bonus LAVEIYE : déroule les phases d'abonnement calculées au moment
    // du paiement. Trois cas (cf. lib/promo-codes.ts → computePromoPhases) :
    //
    //   - merged : phase unique Basic (durée = plan + 90 j)
    //               → plan='Basic', pas de pending
    //   - before : Basic 90 j AVANT le plan acheté (Discovery)
    //               → plan='Basic', subscription_end = now+90j
    //                 pending_plan='Discovery' à partir de cette date
    //   - after  : plan acheté AVANT le bonus (Pro)
    //               → plan='Pro', subscription_end = now+30/365j
    //                 pending_plan='Basic' à partir de cette date pour 90j
    // ——————————————————————————————————————————————————————————————
    const bonus = metadata.promo_bonus as
      | {
          label?: string
          kind: 'merged' | 'before' | 'after'
          first_phase_plan: 'Basic' | 'Pro'
          first_phase_duration_days: number
          bonus_phase?: {
            plan: 'Discovery' | 'Basic' | 'Pro'
            duration_days: number
            billing?: string
          } | null
        }
      | null
      | undefined

    if (bonus && (bonus.kind === 'merged' || bonus.kind === 'before' || bonus.kind === 'after')) {
      const now = new Date()
      const firstPlan = bonus.first_phase_plan
      const firstDays = bonus.first_phase_duration_days
      const firstEnd = new Date(now.getTime() + firstDays * 24 * 60 * 60 * 1000).toISOString()

      const update: any = {
        plan: firstPlan,
        subscription_status: 'active',
        subscription_start_date: now.toISOString(),
        subscription_end_date: firstEnd,
        updated_at: now.toISOString(),
      }

      if (bonus.kind !== 'merged' && bonus.bonus_phase) {
        update.pending_plan = bonus.bonus_phase.plan
        update.pending_plan_starts_at = firstEnd
        update.pending_duration_days = bonus.bonus_phase.duration_days
        update.pending_billing = bonus.bonus_phase.billing || null
      } else {
        // Pas de pending : on s'assure de ne pas en laisser un ancien traîner.
        update.pending_plan = null
        update.pending_plan_starts_at = null
        update.pending_duration_days = null
        update.pending_billing = null
      }

      console.log('[pawapay/deposit] Activation abonnement + bonus LAVEIYE', {
        userId: metadata.userId,
        kind: bonus.kind,
        firstPlan,
        firstEnd,
        pending: update.pending_plan,
      })

      await (supabaseAdmin as any).from('users').update(update).eq('id', metadata.userId)

      if (metadata.promo_code) {
        // Marquer le code consommé + tracer qui / quel plan / quel montant.
        // Le filtre `eq('promo_status','active').is('promo_redeemed_at',null)`
        // évite tout double-claim si deux callbacks arrivent en parallèle.
        await (supabaseAdmin as any)
          .from('keynote_registrations')
          .update({
            promo_redeemed_at: new Date().toISOString(),
            promo_status: 'used',
            promo_redeemed_by_user_id: metadata.userId,
            promo_redeemed_plan: firstPlan,
            promo_redeemed_amount: typeof payment.amount === 'number' ? payment.amount : null,
          })
          .eq('promo_code', metadata.promo_code)
          .is('promo_redeemed_at', null)
      }

      console.log(
        '\u2705 Subscription activated with LAVEIYE bonus for user:',
        metadata.userId,
        '\u2014 first phase:',
        firstPlan
      )

      // Notifications transactionnelles (best-effort)
      const refId = (payment as any).ref_command || payment.id
      void notifyPaymentSuccess({
        userId: metadata.userId,
        plan: firstPlan,
        amount: typeof payment.amount === 'number' ? payment.amount : 0,
        currency: (payment as any).currency || 'XOF',
        reference: String(refId),
        billingPeriod: metadata.billing,
      })
      if (metadata.promo_code) {
        void notifyPromoCodeRedeemed({
          userId: metadata.userId,
          promoCode: String(metadata.promo_code),
          plan: firstPlan,
          bonusLabel: bonus.label,
        })
      }
      return
    }

    // ——————————————————————————————————————————————————————————————
    // Cas sans promo : comportement historique.
    // ——————————————————————————————————————————————————————————————
    const end =
      metadata.subscription_end_date ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Downgrade différé : on stocke en `pending_plan` au lieu d'écraser
    // le plan courant. Le cron `apply-pending-plans` basculera à expiration.
    if (metadata.is_downgrade === true && metadata.pending_starts_at) {
      console.log('[pawapay/deposit] Downgrade programmé', {
        userId: metadata.userId,
        pendingPlan: planName,
        startsAt: metadata.pending_starts_at,
        durationDays: metadata.duration_days,
      })

      await (supabaseAdmin as any)
        .from('users')
        .update({
          pending_plan: planName,
          pending_plan_starts_at: metadata.pending_starts_at,
          pending_billing: metadata.billing || null,
          pending_duration_days: metadata.duration_days || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', metadata.userId)

      console.log('✅ Downgrade différé enregistré pour user:', metadata.userId, '— pending:', planName)
      return
    }

    console.log('[pawapay/deposit] Activation abonnement', {
      userId: metadata.userId,
      plan: planName,
      end,
    })

    await (supabaseAdmin as any)
      .from('users')
      .update({
        plan: planName,
        subscription_status: 'active',
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: end,
        updated_at: new Date().toISOString(),
      })
      .eq('id', metadata.userId)

    console.log('✅ Subscription activated (pawapay) for user:', metadata.userId, '— plan:', planName)

    // Notification transactionnelle (best-effort)
    const refId = (payment as any).ref_command || payment.id
    void notifyPaymentSuccess({
      userId: metadata.userId,
      plan: planName,
      amount: typeof payment.amount === 'number' ? payment.amount : 0,
      currency: (payment as any).currency || 'XOF',
      reference: String(refId),
      billingPeriod: metadata.billing,
    })
  } catch (e) {
    console.error('Error activating subscription from pawapay callback:', e)
  }
}

/**
 * Active une demande de suivi de marque payée :
 *  - status → completed (« Disponible » : auto-approbation sur paiement OK)
 *  - paid_at = now
 *  - payment_reference = depositId
 *  - payment_method = "pawapay/<provider>"
 *  - next_renewal_at = paid_at + 1 mois (si non déjà défini)
 *  - envoie l'email "payment_confirmed" puis "completed"
 */
async function activateBrandRequest(
  payment: { id: string; metadata?: any; ref_command?: string },
  payload: PawaPayDepositCallback,
) {
  try {
    const metadata = payment.metadata || {}
    const brandRequestId: string | undefined = metadata.brand_request_id
    if (!brandRequestId) {
      console.warn('[pawapay/deposit] brand_request payment sans brand_request_id', metadata)
      return
    }

    // Charger la demande pour décider next_renewal_at
    const { data: req } = await (supabaseAdmin as any)
      .from('brand_requests')
      .select('id, status, paid_at, next_renewal_at, devis_amount')
      .eq('id', brandRequestId)
      .maybeSingle()

    if (!req) {
      console.warn('[pawapay/deposit] brand_request introuvable', brandRequestId)
      return
    }

    // Idempotence : déjà payée
    if (req.paid_at && (req.status === 'in_production' || req.status === 'completed')) {
      console.log('[pawapay/deposit] brand_request déjà active, callback ignoré', brandRequestId)
      return
    }

    const now = new Date()
    const nextRenewal =
      req.next_renewal_at || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const provider = payload.payer?.accountDetails?.provider || 'pawapay'
    const depositId = (payment as any).ref_command || payload.depositId

    const { error: updateError } = await (supabaseAdmin as any)
      .from('brand_requests')
      .update({
        // Paiement OK = approbation automatique : la demande devient "Disponible"
        // immédiatement, ce qui débloque l'affichage des contenus côté dashboard.
        status: 'completed',
        paid_at: now.toISOString(),
        payment_reference: depositId,
        payment_method: `pawapay/${provider}`,
        next_renewal_at: nextRenewal,
        auto_renew: true,
        updated_at: now.toISOString(),
      })
      .eq('id', brandRequestId)

    if (updateError) {
      console.error('[pawapay/deposit] update brand_request failed', updateError)
      return
    }

    // Envoi des emails / notifications (non bloquant)
    try {
      const { sendBrandRequestEmail, createBrandRequestNotification } = await import(
        '@/lib/brand-request-emails'
      )
      const { data: full } = await (supabaseAdmin as any)
        .from('brand_requests')
        .select('*')
        .eq('id', brandRequestId)
        .maybeSingle()
      if (full) {
        await Promise.allSettled([
          sendBrandRequestEmail('payment_confirmed', full),
          sendBrandRequestEmail('completed', full),
          createBrandRequestNotification('payment_confirmed', full),
          createBrandRequestNotification('completed', full),
        ])
      }
    } catch (e) {
      console.error('[pawapay/deposit] notif/email brand_request failed', e)
    }

    console.log('✅ brand_request activée (pawapay):', brandRequestId)
  } catch (e) {
    console.error('Error activating brand_request from pawapay callback:', e)
  }
}
