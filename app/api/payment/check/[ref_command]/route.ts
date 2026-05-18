/**
 * API Route: POST /api/payment/check/[ref_command]
 *
 * Verifie le statut d'un paiement directement aupres de PawaPay
 * et met a jour la base de donnees si le paiement est complete.
 * Fallback si le callback n'a pas ete recu.
 *
 * Avec PawaPay, le `ref_command` est exactement le `depositId` (UUIDv4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDepositStatus } from '@/lib/pawapay';
import { createClient } from '@supabase/supabase-js';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

/** Mappe un statut PawaPay vers notre statut interne. */
function mapPawaPayStatus(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'REJECTED':
      return 'rejected';
    case 'DUPLICATE_IGNORED':
      return 'duplicate';
    case 'ACCEPTED':
    case 'ENQUEUED':
    case 'PROCESSING':
    case 'IN_RECONCILIATION':
    default:
      return 'pending';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref_command: string }> }
) {
  try {
    const { ref_command } = await params;
    const supabase = getSupabase() as any;

    if (!ref_command) {
      return NextResponse.json(
        { error: 'Reference command is required' },
        { status: 400 }
      );
    }

    // 1. Recuperer le paiement dans notre base
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('ref_command', ref_command)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found in database' },
        { status: 404 }
      );
    }

    const paymentData = payment as any;

    // Deja complete
    if (paymentData.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Payment already completed',
        payment: {
          ref_command: paymentData.ref_command,
          status: paymentData.status,
          amount: paymentData.final_amount || paymentData.amount,
          completed_at: paymentData.completed_at,
        },
      });
    }

    // 2. Verifier aupres de PawaPay (ref_command === depositId)
    const pawapayResult = await checkDepositStatus(ref_command);

    if (pawapayResult.status === 'NOT_FOUND' || !pawapayResult.data) {
      return NextResponse.json({
        success: false,
        message: 'Deposit not yet registered on PawaPay',
        payment: {
          ref_command: paymentData.ref_command,
          status: paymentData.status,
        },
      });
    }

    const deposit = pawapayResult.data;
    const mappedStatus = mapPawaPayStatus(deposit.status);

    console.log('PawaPay check result:', {
      depositId: deposit.depositId,
      status: deposit.status,
      mapped: mappedStatus,
    });

    // 3. Si COMPLETED : activer l'utilisateur / finaliser la commande
    if (mappedStatus === 'completed') {
      const updateData: Record<string, unknown> = {
        status: 'completed',
        payment_method: 'pawapay',
        provider: deposit.payer?.accountDetails?.provider,
        client_phone: deposit.payer?.accountDetails?.phoneNumber,
        provider_transaction_id: deposit.providerTransactionId,
        completed_at: deposit.created || new Date().toISOString(),
        final_amount: deposit.amount ? Number(deposit.amount) : paymentData.amount,
        currency: deposit.currency || paymentData.currency,
      };

      await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentData.id);

      // Abonnement : activer l'utilisateur
      if (paymentData.metadata?.type === 'subscription' && paymentData.metadata?.userId) {
        const subscriptionEndDate = paymentData.metadata.subscription_end_date
          ? new Date(paymentData.metadata.subscription_end_date)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Plan strict — pas de fallback silencieux vers Pro.
        // Le plan doit etre present dans metadata (genere par /api/payment/subscribe).
        const rawPlan = String(paymentData.metadata.plan || '').toLowerCase().trim();
        let planName: 'Discovery' | 'Basic' | 'Pro' | null = null;
        if (rawPlan === 'basic') planName = 'Basic';
        else if (rawPlan === 'pro') planName = 'Pro';
        else if (rawPlan === 'discovery' || rawPlan === 'free') planName = 'Discovery';

        if (!planName) {
          console.error(
            '[pawapay/check] Plan invalide ou manquant dans metadata, activation annulee',
            { paymentId: paymentData.id, rawPlan, metadata: paymentData.metadata }
          );
        } else if (
          paymentData.metadata.is_downgrade === true &&
          paymentData.metadata.pending_starts_at
        ) {
          // Downgrade différé : écrire pending_* au lieu d'écraser plan courant.
          // Doit rester aligné avec la même branche dans le callback PawaPay
          // (app/api/payment/pawapay/callback/deposit/route.ts).
          await supabase
            .from('users')
            .update({
              pending_plan: planName,
              pending_plan_starts_at: paymentData.metadata.pending_starts_at,
              pending_billing: paymentData.metadata.billing || null,
              pending_duration_days: paymentData.metadata.duration_days || null,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', paymentData.metadata.userId);

          if (paymentData.metadata.promo_code) {
            await supabase
              .from('keynote_registrations')
              .update({ promo_redeemed_at: new Date().toISOString() } as any)
              .eq('promo_code', paymentData.metadata.promo_code)
              .is('promo_redeemed_at', null);
          }

          console.log(
            '[pawapay/check] Downgrade différé enregistré pour user:',
            paymentData.metadata.userId,
            '— pending:', planName
          );
        } else {
          await supabase
            .from('users')
            .update({
              plan: planName,
              subscription_status: 'active',
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: subscriptionEndDate.toISOString(),
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', paymentData.metadata.userId);

          console.log('User subscription activated:', paymentData.metadata.userId, '— plan:', planName);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment verified and activated',
        payment: {
          ref_command: paymentData.ref_command,
          status: 'completed',
          amount: deposit.amount,
          currency: deposit.currency,
        },
      });
    }

    // 4. Si FAILED / REJECTED : mettre a jour la base
    if (mappedStatus === 'failed' || mappedStatus === 'rejected') {
      await supabase
        .from('payments')
        .update({
          status: mappedStatus,
          failure_code: deposit.failureReason?.failureCode,
          failure_message: deposit.failureReason?.failureMessage,
        } as any)
        .eq('id', paymentData.id);

      return NextResponse.json({
        success: false,
        message: 'Payment failed',
        payment: {
          ref_command: paymentData.ref_command,
          status: mappedStatus,
          pawapay_status: deposit.status,
          failureReason: deposit.failureReason,
        },
      });
    }

    // 5. Paiement en cours : informations de suivi
    return NextResponse.json({
      success: false,
      message: 'Payment not yet completed',
      payment: {
        ref_command: paymentData.ref_command,
        status: paymentData.status,
        pawapay_status: deposit.status,
        nextStep: deposit.nextStep,
        authorizationUrl: deposit.authorizationUrl,
      },
    });

  } catch (error) {
    console.error('Check payment error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
