/**
 * API Route: POST /api/promo/validate
 *
 * Valide un code promo LAVEIYE distribué lors de l'inscription au keynote
 * et retourne les conditions de l'offre (3 mois Basic à 10 000 FCFA).
 *
 * Body: { code: string }
 * Réponse OK : { valid: true, offer: { plan, price, originalPrice, durationDays, ... } }
 * Réponse KO : { valid: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import {
  KEYNOTE_PROMO_OFFER,
  isPromoCodeFormatValid,
  normalizePromoCode,
} from '@/lib/promo-codes'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  // Rate-limit anti brute-force : LAVEIYE-XXXX a ~1M combinaisons,
  // 8 essais / 5 min par IP rendent l'énumération impraticable.
  const ip = getClientIp(request)
  const rl = rateLimit(`promo-validate:${ip}`, 8, 5 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 }
    )
  }

  let body: { code?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ valid: false, error: 'JSON invalide' }, { status: 400 })
  }

  const code = normalizePromoCode(body.code)
  const email = String(body.email || '').trim().toLowerCase()

  if (!code) {
    return NextResponse.json({ valid: false, error: 'Code requis' }, { status: 400 })
  }
  if (!isPromoCodeFormatValid(code)) {
    return NextResponse.json(
      { valid: false, error: 'Format de code invalide (attendu : LAVEIYE-XXXX)' },
      { status: 400 }
    )
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { valid: false, error: 'Email requis pour valider le code (combinaison code + email).' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  // Validation par couple (code, email) : single-use bloque la redemption,
  // et la combinaison empêche un tiers d'utiliser un code volé sans
  // connaître aussi l'email du destinataire d'origine.
  const { data, error } = await supabase
    .from('keynote_registrations')
    .select('id, email, promo_code, promo_redeemed_at')
    .eq('promo_code', code)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { valid: false, error: 'Erreur serveur lors de la vérification' },
      { status: 500 }
    )
  }

  if (!data) {
    // Message volontairement générique pour ne pas révéler si c'est l'email
    // ou le code qui est faux (évite l'énumération).
    return NextResponse.json(
      { valid: false, error: 'Code promo invalide ou email ne correspondant pas.' },
      { status: 404 }
    )
  }

  if (data.promo_redeemed_at) {
    return NextResponse.json(
      { valid: false, error: 'Ce code a déjà été utilisé' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    valid: true,
    offer: {
      plan: KEYNOTE_PROMO_OFFER.plan,
      planLabel: KEYNOTE_PROMO_OFFER.planLabel,
      price: KEYNOTE_PROMO_OFFER.price,
      originalPrice: KEYNOTE_PROMO_OFFER.originalPrice,
      durationDays: KEYNOTE_PROMO_OFFER.durationDays,
      durationLabel: KEYNOTE_PROMO_OFFER.durationLabel,
      billing: KEYNOTE_PROMO_OFFER.billing,
    },
  })
}
