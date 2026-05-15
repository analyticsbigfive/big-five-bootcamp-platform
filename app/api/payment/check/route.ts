/**
 * API Route: GET/POST /api/payment/check
 * 
 * Outil de diagnostic et récupération de paiements
 * Permet de vérifier un paiement directement auprès de PayTech
 * et de le créer/mettre à jour dans la base de données si nécessaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SUBSCRIPTION_DURATION_DAYS = 30;

/**
 * Active l'abonnement pour l'utilisateur associé à un paiement.
 * Le plan est lu strictement depuis payment.metadata.plan (ou explicitOverride).
 * AUCUN fallback silencieux vers Pro : si le plan est absent/invalide, log et abort.
 */
async function activatePremiumForPayment(payment: any, explicitOverride?: string) {
  const userId = payment.metadata?.userId || payment.user_id;
  const userEmail = payment.metadata?.userEmail || payment.user_email;

  if (!userId && !userEmail) {
    console.warn('⚠️ Impossible d\'activer l\'abonnement: pas de userId/email dans le paiement', payment.id);
    return;
  }

  // Plan strict — source : metadata.plan, sinon explicitOverride (admin POST), sinon abort.
  const rawPlan = String(explicitOverride || payment.metadata?.plan || '').toLowerCase().trim();
  let planName: 'Discovery' | 'Basic' | 'Pro' | null = null;
  if (rawPlan === 'basic') planName = 'Basic';
  else if (rawPlan === 'pro') planName = 'Pro';
  else if (rawPlan === 'discovery' || rawPlan === 'free') planName = 'Discovery';

  if (!planName) {
    console.error(
      '[payment/check] Plan invalide ou manquant, activation annulee',
      { paymentId: payment.id, rawPlan, metadata: payment.metadata }
    );
    return;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  try {
    let query = (supabaseAdmin as any).from('users').update({
      plan: planName,
      subscription_status: 'active',
      subscription_start_date: now.toISOString(),
      subscription_end_date: endDate.toISOString(),
      updated_at: now.toISOString(),
    });

    if (userId) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('email', userEmail);
    }

    const { error } = await query;
    if (error) {
      console.error('❌ Erreur activation abonnement:', error.message);
    } else {
      console.log('✅ Abonnement', planName, 'activé pour:', userId || userEmail, '→ fin le', endDate.toISOString());
    }
  } catch (err) {
    console.error('❌ Exception activation abonnement:', err);
  }
}

// Vérifier un paiement par téléphone ou email (admin uniquement)
export async function GET(request: NextRequest) {
  try {
    // Garde admin : empêche l'exposition publique de paiements (PII).
    const { getSupabaseServer } = await import('@/lib/supabase-server');
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const { ADMIN_EMAILS } = await import('@/lib/admin-auth');
    const isAdmin = user.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase());
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');
    const ref = searchParams.get('ref');

    if (!phone && !email && !ref) {
      return NextResponse.json(
        { error: 'Veuillez fournir un téléphone, email ou référence' },
        { status: 400 }
      );
    }

    let query = (supabaseAdmin as any)
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (ref) {
      query = query.ilike('ref_command', `%${ref}%`);
    } else if (phone) {
      query = query.ilike('client_phone', `%${phone.replace(/\s/g, '')}%`);
    } else if (email) {
      query = query.or(`client_email.ilike.%${email}%,user_email.ilike.%${email}%`);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error('Error searching payments:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la recherche', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: payments?.length || 0,
      payments: (payments || []).map((p: any) => ({
        id: p.id,
        ref_command: p.ref_command,
        status: p.status,
        amount: p.amount,
        payment_method: p.payment_method,
        client_phone: p.client_phone,
        item_name: p.item_name,
        created_at: p.created_at,
        completed_at: p.completed_at,
      })),
    });

  } catch (error) {
    console.error('Payment check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Créer ou mettre à jour un paiement manuellement (admin seulement)
export async function POST(request: NextRequest) {
  try {
    // Garde admin : session Supabase + rôle 'admin' (ou email whitelist).
    // Permet aussi un appel serveur->serveur via header X-Admin-Secret.
    const adminSecret = process.env.ADMIN_PAYMENT_CHECK_SECRET;
    const providedSecret = request.headers.get('x-admin-secret');
    const secretOk = !!adminSecret && providedSecret === adminSecret;

    if (!secretOk) {
      const { getSupabaseServer } = await import('@/lib/supabase-server');
      const supabaseServer = await getSupabaseServer();
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }
      const adminEmails = [
        'jeanluc@bigfiveabidjan.com',
        'cossi@bigfiveabidjan.com',
        'yannick@bigfiveabidjan.com',
        'franck@bigfiveabidjan.com',
        'stephanie@bigfiveabidjan.com',
      ];
      const isAdmin = user.user_metadata?.role === 'admin' || adminEmails.includes(user.email || '');
      if (!isAdmin) {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { ref_command, phone, status, amount, payment_method, item_name, user_id, plan: planOverride } = body;

    // Vérifier si le paiement existe déjà
    const { data: existingPayment } = await (supabaseAdmin as any)
      .from('payments')
      .select('*')
      .eq('ref_command', ref_command)
      .single();

    if (existingPayment) {
      // Mettre à jour le paiement existant
      const { data: updated, error } = await (supabaseAdmin as any)
        .from('payments')
        .update({
          status: status || 'completed',
          payment_method: payment_method || existingPayment.payment_method,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('ref_command', ref_command)
        .select()
        .single();

      if (error) throw error;

      // Si paiement complété, activer l'abonnement
      if ((status || 'completed') === 'completed') {
        await activatePremiumForPayment(existingPayment, planOverride);
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        payment: updated,
      });
    } else {
      // Créer un nouveau paiement
      const { data: created, error } = await (supabaseAdmin as any)
        .from('payments')
        .insert({
          ref_command,
          status: status || 'completed',
          amount: amount || 0,
          currency: 'XOF',
          payment_method: payment_method || 'unknown',
          client_phone: phone,
          item_name: item_name || 'Paiement manuel',
          user_id: user_id,
          created_at: new Date().toISOString(),
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Si paiement complété et user_id fourni, activer l'abonnement (plan requis explicitement)
      if ((status || 'completed') === 'completed' && user_id) {
        await activatePremiumForPayment(
          { id: created?.id, user_id, user_email: body.email, metadata: { plan: planOverride } },
          planOverride
        );
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        payment: created,
      });
    }

  } catch (error: any) {
    console.error('Payment create/update error:', error);
    return NextResponse.json(
      { error: 'Erreur', details: error.message },
      { status: 500 }
    );
  }
}
