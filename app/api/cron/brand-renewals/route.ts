/**
 * GET /api/cron/brand-renewals
 *
 * Cron quotidien pour le suivi de marques :
 *  - Envoie un email de rappel J-7 avant la date de renouvellement
 *    (à condition que `auto_renew = true` et que le rappel n'ait pas déjà
 *    été envoyé pour ce cycle).
 *  - Marque `renewal_reminder_sent_at` pour éviter les doublons.
 *
 * Le déclenchement automatique du paiement n'est PAS effectué ici :
 * il dépend du gateway (PawaPay/PayTech) et nécessite la mise en place
 * d'un mandat de prélèvement. Le rappel J-7 invite l'utilisateur à
 * confirmer/payer manuellement depuis son espace.
 *
 * Sécurité : header `Authorization: Bearer ${CRON_SECRET}` requis
 * (Vercel Cron envoie ce header automatiquement).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  sendBrandRequestEmail,
  createBrandRequestNotification,
} from '@/lib/brand-request-emails'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Fail-closed : si le secret n'est pas configuré, on refuse plutôt que
  // d'exposer un endpoint publiquement déclenchable.
  if (!cronSecret) {
    console.error('[cron/brand-renewals] CRON_SECRET non configuré')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const now = new Date()
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  // Demandes éligibles : approuvées, auto-renew, dans la fenêtre J-7
  const { data: candidates, error } = await admin
    .from('brand_requests')
    .select('id, user_id, brand_name, next_renewal_at, devis_amount, devis_currency, renewal_reminder_sent_at, auto_renew, status')
    .eq('status', 'completed')
    .eq('auto_renew', true)
    .not('next_renewal_at', 'is', null)
    .lte('next_renewal_at', sevenDaysFromNow.toISOString())
    .gte('next_renewal_at', now.toISOString())

  if (error) {
    console.error('[cron/brand-renewals] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let remindersSent = 0
  for (const r of candidates || []) {
    // Skip si on a déjà envoyé un rappel après la dernière période
    if (r.renewal_reminder_sent_at) {
      const lastSent = new Date(r.renewal_reminder_sent_at)
      const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 14) continue
    }

    try {
      await Promise.all([
        createBrandRequestNotification({
          userId: r.user_id,
          brandRequestId: r.id,
          brandName: r.brand_name,
          kind: 'renewal_reminder',
        }),
        sendBrandRequestEmail({
          userId: r.user_id,
          kind: 'renewal_reminder',
          brandName: r.brand_name,
          context: {
            devisAmount: r.devis_amount,
            devisCurrency: r.devis_currency,
            nextRenewalAt: r.next_renewal_at,
          },
        }),
      ])
      await admin
        .from('brand_requests')
        .update({ renewal_reminder_sent_at: now.toISOString() })
        .eq('id', r.id)
      remindersSent++
    } catch (e) {
      console.error('[cron/brand-renewals] reminder failed for', r.id, e)
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    remindersSent,
  })
}
