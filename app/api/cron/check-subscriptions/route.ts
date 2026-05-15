/**
 * API Route: GET /api/cron/check-subscriptions
 * 
 * Vérifie les abonnements expirés et bascule l'utilisateur en état verrouillé.
 * À appeler via un cron job Vercel (vercel.json) ou manuellement.
 * 
 * Sécurité: Protégé par CRON_SECRET dans les headers
 * 
 * Logique:
 * 1. Trouver les utilisateurs avec subscription_end_date < NOW() et subscription_status = 'active'
 * 2. Mettre subscription_status = 'expired' et plan = NULL (compte verrouillé)
 * 3. Logger les utilisateurs downgradués
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Vérification de sécurité : CRON_SECRET obligatoire.
    // Refuse l'appel si la variable d'env est absente (évite un endpoint
    // publiquement déclenchable en cas de mauvaise config Vercel).
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[cron/check-subscriptions] CRON_SECRET non configuré');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 1. Trouver les abonnements actifs qui ont expiré
    const { data: expiredUsers, error: fetchError } = await (supabaseAdmin as any)
      .from('users')
      .select('id, email, name, plan, subscription_status, subscription_end_date')
      .eq('subscription_status', 'active')
      .lt('subscription_end_date', now);

    if (fetchError) {
      console.error('❌ Erreur récupération abonnements expirés:', fetchError.message);
      return NextResponse.json(
        { error: 'Erreur de base de données', details: fetchError.message },
        { status: 500 }
      );
    }

    const hasExpired = !!(expiredUsers && expiredUsers.length)
    if (!hasExpired) {
      console.log(`Aucun abonnement expiré.`)
    } else {
      console.log(`⏰ ${expiredUsers.length} abonnement(s) payant(s) expiré(s) trouvé(s)`);

      // 2. Downgrader tous les utilisateurs expirés
      const userIds = expiredUsers.map((u: any) => u.id);

      const { error: updateError } = await (supabaseAdmin as any)
        .from('users')
        .update({
          plan: null,
          subscription_status: 'expired',
          updated_at: now,
        })
        .in('id', userIds);

      if (updateError) {
        console.error('❌ Erreur downgrade abonnements:', updateError.message);
        return NextResponse.json(
          { error: 'Erreur lors du downgrade', details: updateError.message },
          { status: 500 }
        );
      }

      // 3. Créer des notifications d'expiration pour chaque utilisateur
      for (const user of expiredUsers) {
        try {
          await (supabaseAdmin as any)
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'subscription_expired',
              title: '⏰ Votre abonnement a expiré',
              message: `Votre abonnement ${user.plan || 'Discovery'} a expiré. Renouvelez-le pour continuer à accéder à toutes les fonctionnalités.`,
              metadata: {
                subscription_end_date: user.subscription_end_date,
                previous_plan: user.plan,
              },
            });
        } catch (notifError) {
          console.warn('⚠️ Erreur notification pour', user.email, ':', notifError);
        }
      }
    }

    // 3bis. Rappel J-7 : abonnements ACTIFS dont la fin tombe dans 0..7 jours.
    // On envoie une notif "subscription_expiring" une seule fois par
    // (user, subscription_end_date) en s'appuyant sur metadata pour
    // l'idempotence (pas besoin de nouvelle colonne DB).
    let expiringRemindersSent = 0
    try {
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: expiringUsers } = await (supabaseAdmin as any)
        .from('users')
        .select('id, email, name, plan, subscription_end_date')
        .eq('subscription_status', 'active')
        .gte('subscription_end_date', now)
        .lte('subscription_end_date', sevenDays)

      // Idempotence batchée : récupère en une requête toutes les notifs
      // 'subscription_expiring' déjà envoyées pour les utilisateurs ciblés,
      // puis filtre côté serveur sur (user_id, metadata.subscription_end_date).
      // Évite un N+1 sur la table notifications lors du cron.
      const expiringUserIds = (expiringUsers || []).map((u: any) => u.id)
      const sentKeys = new Set<string>()
      if (expiringUserIds.length > 0) {
        const { data: sentNotifs } = await (supabaseAdmin as any)
          .from('notifications')
          .select('user_id, metadata')
          .eq('type', 'subscription_expiring')
          .in('user_id', expiringUserIds)
        for (const n of (sentNotifs || [])) {
          const end = n?.metadata?.subscription_end_date
          if (end) sentKeys.add(`${n.user_id}|${end}`)
        }
      }

      for (const u of (expiringUsers || [])) {
        if (sentKeys.has(`${u.id}|${u.subscription_end_date}`)) continue

        const endDate = new Date(u.subscription_end_date)
        const daysLeft = Math.max(
          0,
          Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
        const planForRenew = String(u.plan || '').toLowerCase() === 'pro' ? 'pro'
          : String(u.plan || '').toLowerCase() === 'basic' ? 'basic'
          : 'discovery'

        await (supabaseAdmin as any).from('notifications').insert({
          user_id: u.id,
          type: 'subscription_expiring',
          title: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
          message: `Renouvelez votre abonnement ${u.plan || 'Discovery'} pour conserver l'acces.`,
          action_url: `/subscribe?plan=${planForRenew}`,
          metadata: {
            subscription_end_date: u.subscription_end_date,
            plan: u.plan,
            days_left: daysLeft,
          },
        })
        expiringRemindersSent++
      }
      if (expiringRemindersSent > 0) {
        console.log(`Pre-expiry reminders sent: ${expiringRemindersSent}`)
      }
    } catch (reminderErr) {
      console.error('Erreur envoi rappels pre-expiration:', reminderErr)
    }

    // 4. Reset mensuel des compteurs de clics (le 1er du mois)
    const today = new Date()
    if (today.getDate() === 1) {
      const { error: resetError, count: resetCount } = await (supabaseAdmin as any)
        .from('users')
        .update({ 
          monthly_click_count: 0, 
          monthly_campaigns_explored: 0,
          monthly_click_reset: now,
        })
        .lt('monthly_click_reset', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())

      if (!resetError) {
        console.log(`🔄 Compteurs mensuels réinitialisés`)
      }
    }

    // 5. Logger les résultats
    const downgraded = hasExpired
      ? expiredUsers.map((u: any) => ({
          email: u.email,
          name: u.name,
          expired_at: u.subscription_end_date,
        }))
      : []

    if (hasExpired) {
      console.log('✅ Abonnements downgradués:', JSON.stringify(downgraded, null, 2));
    }

    return NextResponse.json({
      success: true,
      message: hasExpired
        ? `${expiredUsers.length} abonnement(s) downgradué(s)`
        : 'Aucun abonnement expiré.',
      downgraded: hasExpired ? expiredUsers.length : 0,
      expiring_reminders_sent: expiringRemindersSent,
      users: downgraded,
      checked_at: now,
    });

  } catch (error: any) {
    console.error('❌ Erreur cron check-subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
