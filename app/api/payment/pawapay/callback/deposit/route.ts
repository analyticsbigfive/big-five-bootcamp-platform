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
  type PawaPayDepositCallback,
} from '@/lib/pawapay'

// PawaPay doit pouvoir accéder à cette route sans auth. On désactive aussi
// le cache et on force un rendu dynamique pour ne rien louper.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 1. Vérification IP (optionnelle, activée via PAWAPAY_VERIFY_IP=true)
    if (!isAllowedPawaPayIP(request)) {
      console.warn('⚠️ PawaPay deposit callback reçu depuis une IP non autorisée')
      // On renvoie quand même 200 pour éviter une boucle de retry côté PawaPay,
      // mais on n'agit pas sur la donnée.
      return new NextResponse('IP not allowed', { status: 200 })
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
      .select('id, status, metadata, user_email')
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

    // 3. Mapping statut PawaPay → statut interne
    const internalStatus = mapDepositStatus(payload.status)

    const { error: updateError } = await (supabaseAdmin as any)
      .from('payments')
      .update({
        status: internalStatus,
        payment_method: payload.payer?.accountDetails?.provider || 'pawapay',
        client_phone: payload.payer?.accountDetails?.phoneNumber || null,
        final_amount: payload.amount ? Number(payload.amount) : undefined,
        completed_at:
          internalStatus === 'completed' ? new Date().toISOString() : undefined,
        ipn_data: payload as any,
        provider_transaction_id: payload.providerTransactionId || null,
        failure_code: payload.failureReason?.failureCode || null,
        failure_message: payload.failureReason?.failureMessage || null,
        authorization_url: payload.authorizationUrl || null,
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('❌ Supabase update payment error:', updateError)
      // On renvoie 200 quand même — on pourra rejouer le callback manuellement
      return new NextResponse('OK', { status: 200 })
    }

    // 4. Side-effects métier lorsque le paiement est complété
    if (payload.status === 'COMPLETED') {
      const metadata = (payment.metadata || {}) as any
      if (metadata.type === 'brand_request') {
        await activateBrandRequest(payment, payload)
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
  metadata?: any
}) {
  try {
    const metadata = payment.metadata || {}
    if (metadata.type !== 'subscription' || !metadata.userId) return

    const end =
      metadata.subscription_end_date ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

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

    // Marquer le code promo LAVEIYE comme consommé (idempotent)
    if (metadata.promo_code) {
      await (supabaseAdmin as any)
        .from('keynote_registrations')
        .update({ promo_redeemed_at: new Date().toISOString() })
        .eq('promo_code', metadata.promo_code)
        .is('promo_redeemed_at', null)
    }

    console.log('✅ Subscription activated (pawapay) for user:', metadata.userId, '— plan:', planName)
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
