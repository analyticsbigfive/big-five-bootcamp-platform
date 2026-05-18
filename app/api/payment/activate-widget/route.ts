/**
 * API Route: POST /api/payment/activate-widget
 * 
 * Endpoint appelé côté client quand le widget Chariow signale un paiement réussi.
 * 
 * Flux :
 * 1. Client détecte PAYMENT_SUCCESSFUL ou chariow-purchase-completed via postMessage
 * 2. Client appelle cette route avec l'email de l'utilisateur et le purchaseId
 * 3. Le serveur vérifie le paiement via l'API Chariow (si API key dispo)
 * 4. Le serveur active l'abonnement dans Supabase
 * 
 * Cet endpoint ne dépend PAS du webhook Chariow.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CHARIOW_CONFIG, generateRefCommand, getSale } from '@/lib/chariow';
import { PLAN_BASIC, PLAN_PRO } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, purchaseId, plan } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    // Plan strict — pas de fallback silencieux vers Pro.
    // Le widget Chariow doit envoyer explicitement "basic" ou "pro".
    const planKey = String(plan || '').toLowerCase().trim();
    if (planKey !== 'basic' && planKey !== 'pro') {
      console.error('[activate-widget] Plan invalide ou manquant', { email, plan });
      return NextResponse.json(
        { error: 'Plan invalide. Le widget doit envoyer "basic" ou "pro".' },
        { status: 400 }
      );
    }
    const planConfig = planKey === 'basic' ? PLAN_BASIC : PLAN_PRO;
    const planLabel = planConfig.name; // "Basic" ou "Pro"

    console.log('🎯 Widget activation request:', { email, purchaseId, plan: planLabel });

    // 1. Trouver l'utilisateur
    const { data: user, error: userError } = await (supabaseAdmin as any)
      .from('users')
      .select('id, email, name, plan, subscription_status, subscription_start_date, subscription_end_date')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', email, userError);
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // 2. Anti-doublon : vérifier si ce purchaseId a déjà été utilisé OU activation récente
    if (purchaseId) {
      const { data: existingPayment } = await (supabaseAdmin as any)
        .from('payments')
        .select('id, status, completed_at')
        .eq('chariow_sale_id', purchaseId)
        .eq('status', 'completed')
        .limit(1);

      if (existingPayment && existingPayment.length > 0) {
        console.log('⚠️ PurchaseId already used, skipping duplicate:', purchaseId);
        return NextResponse.json({
          success: true,
          alreadyActivated: true,
          message: 'Ce paiement a déjà été traité',
          subscription: {
            plan: user.plan,
            status: user.subscription_status,
            endDate: user.subscription_end_date,
          },
        });
      }
    }

    // Vérifier aussi les activations récentes (dernières 2 minutes)
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentPayment } = await (supabaseAdmin as any)
      .from('payments')
      .select('id, status, completed_at')
      .eq('user_email', email)
      .eq('status', 'completed')
      .gte('completed_at', twoMinAgo)
      .limit(1);

    if (recentPayment && recentPayment.length > 0) {
      console.log('⚠️ Recent activation already exists (< 2min), skipping duplicate');
      return NextResponse.json({
        success: true,
        alreadyActivated: true,
        subscription: {
          plan: user.plan,
          status: user.subscription_status,
          endDate: user.subscription_end_date,
        },
      });
    }

    // 3. Optionnel : vérifier le paiement via l'API Chariow (si API key dispo)
    let saleData: any = null;
    let verifiedAmount = 0;

    if (CHARIOW_CONFIG.API_KEY && purchaseId) {
      try {
        saleData = await getSale(purchaseId);
        verifiedAmount = saleData?.amount?.value || 0;
        console.log('✅ Sale verified via Chariow API:', {
          id: saleData?.id,
          status: saleData?.status,
          amount: verifiedAmount,
        });
      } catch (apiError: any) {
        console.warn('⚠️ Could not verify sale via API (continuing):', apiError.message);
      }
    }

    // 4. Activer l'abonnement
    const now = new Date();
    const isRenewal = user.subscription_status === 'active' &&
      user.subscription_end_date &&
      new Date(user.subscription_end_date) > now;

    let subscriptionEndDate: Date;

    if (isRenewal) {
      // Renouvellement : ajouter 30 jours à la date de fin existante
      subscriptionEndDate = new Date(
        new Date(user.subscription_end_date).getTime() + 30 * 24 * 60 * 60 * 1000
      );
      console.log('🔄 Renewal: extending to', subscriptionEndDate.toISOString());
    } else {
      // Nouvel abonnement : 30 jours à partir de maintenant
      subscriptionEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      console.log('🆕 New subscription until', subscriptionEndDate.toISOString());
    }

    // 5. Mettre à jour l'utilisateur
    const { error: updateError } = await (supabaseAdmin as any)
      .from('users')
      .update({
        plan: planLabel,
        subscription_status: 'active',
        subscription_start_date: isRenewal
          ? (user.subscription_start_date || now.toISOString())
          : now.toISOString(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
      return NextResponse.json({ error: 'Erreur mise à jour abonnement' }, { status: 500 });
    }

    // 6. Créer l'enregistrement de paiement
    const widgetRef = generateRefCommand('WDG');
    const defaultAmount = planConfig.price;
    const { error: paymentError } = await (supabaseAdmin as any)
      .from('payments')
      .insert({
        ref_command: widgetRef,
        user_email: email,
        amount: verifiedAmount || defaultAmount,
        final_amount: verifiedAmount || defaultAmount,
        currency: saleData?.amount?.currency || 'XOF',
        status: 'completed',
        payment_method: 'Chariow Widget',
        chariow_sale_id: purchaseId || null,
        completed_at: now.toISOString(),
        item_name: `Abonnement Laveiye ${planLabel} - Widget`,
        metadata: {
          type: 'subscription',
          userId: user.id,
          source: 'widget_activation',
          plan: planLabel,
          verified_by_api: !!saleData,
          purchase_id: purchaseId,
        },
      });

    if (paymentError) {
      console.error('⚠️ Payment record error (subscription already activated):', paymentError);
    }

    // 7. Mettre à jour les paiements pending de cet utilisateur
    await (supabaseAdmin as any)
      .from('payments')
      .update({ status: 'superseded' })
      .eq('user_email', email)
      .eq('status', 'pending');

    // 8. Notification
    try {
      await (supabaseAdmin as any).rpc('notify_payment_success', {
        p_user_id: user.id,
        p_amount: verifiedAmount || defaultAmount,
        p_subscription_end_date: subscriptionEndDate.toISOString(),
      });
    } catch (notifError) {
      console.warn('Notification error (non-critical):', notifError);
    }

    console.log('✅ Widget subscription activated for:', user.id, `→ plan: ${planLabel}, until`, subscriptionEndDate.toISOString());

    return NextResponse.json({
      success: true,
      subscription: {
        plan: planLabel,
        status: 'active',
        startDate: isRenewal ? user.subscription_start_date : now.toISOString(),
        endDate: subscriptionEndDate.toISOString(),
        isRenewal,
      },
    });

  } catch (error: any) {
    console.error('Widget activation error:', error);
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : error.message,
      },
      { status: 500 }
    );
  }
}
