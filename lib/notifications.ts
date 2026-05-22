/**
 * Notifications transactionnelles via Gmail API (service account + DWD).
 *
 * 3 events:
 *   - notifyPaymentSuccess
 *   - notifyPromoCodeRedeemed
 *   - notifyBrandRequestSubmitted
 *
 * Chaque event envoie :
 *   - 1 email au user (opt-out via email_unsubscribed)
 *   - 1 email interne (SUPPORT_EMAIL, par défaut contacts@bigfiveabidjan.com)
 *
 * Best-effort : pas de throw, échecs loggés.
 */

import { sendMail } from './gmail-sender'
import { getSupabaseAdmin } from './supabase-server'

const DEFAULT_FROM_EMAIL =
  process.env.GMAIL_FROM || process.env.CONTACT_FROM_EMAIL || 'Laveiye <support@laveiye.com>'

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'contacts@bigfiveabidjan.com'

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://laveiye.com'
  ).replace(/\/$/, '')
}

async function getFromEmail(): Promise<string> {
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('site_settings')
      .select('key, value')
      .eq('key', 'contact_from_email')
      .single()
    const value = (data as any)?.value
    return value || DEFAULT_FROM_EMAIL
  } catch {
    return DEFAULT_FROM_EMAIL
  }
}

function esc(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell(title: string, body: string, cta?: { url: string; label: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;color:#0f0f0f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#F2B33D,#d99a2a);color:#fff">
          <h1 style="margin:0;font-size:20px;font-weight:700">${esc(title)}</h1>
        </td></tr>
        <tr><td style="padding:28px">
          ${body}
          ${
            cta
              ? `<div style="margin-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#F2B33D;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></div>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;color:#666;font-size:12px">
          Laveiye · La référence créative ouest-africaine<br>
          <a href="${esc(appUrl())}" style="color:#666">${esc(appUrl())}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function send(args: {
  to: string | string[]
  subject: string
  html: string
}): Promise<void> {
  if (!process.env.GMAIL_PRIVATE_KEY) {
    console.warn('[notifications] GMAIL_PRIVATE_KEY missing, skip:', args.subject)
    return
  }
  const from = await getFromEmail()
  const result = await sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
  })
  if (!result.ok) {
    console.error('[notifications] send failed:', args.subject, result.error)
  }
}

async function getUserContact(userId: string) {
  try {
    const admin = getSupabaseAdmin()
    const { data } = await (admin as any)
      .from('users')
      .select('email, name, email_unsubscribed')
      .eq('id', userId)
      .single()
    return data as { email: string; name: string | null; email_unsubscribed: boolean | null } | null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 1. Paiement reussi
// ---------------------------------------------------------------------------

export async function notifyPaymentSuccess(params: {
  userId: string
  plan: string
  amount: number
  currency: string
  reference: string
  billingPeriod?: string
}): Promise<void> {
  const u = await getUserContact(params.userId)
  if (!u?.email) return

  const amount = `${params.amount.toLocaleString('fr-FR')} ${params.currency}`
  const planLabel = params.plan

  // ---- User ----
  if (!u.email_unsubscribed) {
    const userBody = `
      <p style="margin:0 0 12px;font-size:16px">Bonjour ${esc(u.name || '')},</p>
      <p style="margin:0 0 12px">Votre paiement a bien été reçu. Bienvenue sur votre plan <strong>${esc(planLabel)}</strong> !</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#666">Plan</td><td style="text-align:right;font-weight:600">${esc(planLabel)}</td></tr>
        <tr><td style="padding:8px 0;color:#666">Montant</td><td style="text-align:right;font-weight:600">${esc(amount)}</td></tr>
        ${params.billingPeriod ? `<tr><td style="padding:8px 0;color:#666">Période</td><td style="text-align:right;font-weight:600">${esc(params.billingPeriod)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#666">Référence</td><td style="text-align:right;font-family:monospace;font-size:12px">${esc(params.reference)}</td></tr>
      </table>
      <p style="margin:12px 0 0;color:#666;font-size:14px">Vous avez désormais accès à la bibliothèque créative complète.</p>
    `
    await send({
      to: u.email,
      subject: `✅ Paiement confirmé — Plan ${planLabel}`,
      html: shell('Paiement confirmé', userBody, {
        url: `${appUrl()}/dashboard`,
        label: 'Accéder à mon dashboard',
      }),
    })
  }

  // ---- Admin ----
  const adminBody = `
    <p style="margin:0 0 12px;font-size:16px">Nouveau paiement encaissé.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#666">User</td><td style="text-align:right">${esc(u.name || '—')} · ${esc(u.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Plan</td><td style="text-align:right;font-weight:600">${esc(planLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Montant</td><td style="text-align:right;font-weight:600">${esc(amount)}</td></tr>
      ${params.billingPeriod ? `<tr><td style="padding:6px 0;color:#666">Période</td><td style="text-align:right">${esc(params.billingPeriod)}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#666">Référence</td><td style="text-align:right;font-family:monospace;font-size:12px">${esc(params.reference)}</td></tr>
    </table>
  `
  await send({
    to: SUPPORT_EMAIL,
    subject: `[Laveiye] Paiement ${amount} — ${planLabel}`,
    html: shell('💰 Paiement reçu', adminBody, {
      url: `${appUrl()}/admin/payments`,
      label: 'Voir le dashboard paiements',
    }),
  })
}

// ---------------------------------------------------------------------------
// 2. Code promo utilise
// ---------------------------------------------------------------------------

export async function notifyPromoCodeRedeemed(params: {
  userId: string
  promoCode: string
  plan: string
  bonusLabel?: string
}): Promise<void> {
  const u = await getUserContact(params.userId)
  if (!u?.email) return

  // ---- User ----
  if (!u.email_unsubscribed) {
    const userBody = `
      <p style="margin:0 0 12px;font-size:16px">Bonjour ${esc(u.name || '')},</p>
      <p style="margin:0 0 12px">Votre code promo <strong style="font-family:monospace;background:#fff7e6;padding:2px 8px;border-radius:6px">${esc(params.promoCode)}</strong> a bien été appliqué.</p>
      ${params.bonusLabel ? `<p style="margin:0 0 12px;padding:12px;background:#fff7e6;border-radius:10px;color:#92400e">🎁 ${esc(params.bonusLabel)}</p>` : ''}
      <p style="margin:12px 0 0;color:#666;font-size:14px">Plan actif : <strong>${esc(params.plan)}</strong></p>
    `
    await send({
      to: u.email,
      subject: `🎁 Code promo ${params.promoCode} appliqué`,
      html: shell('Code promo appliqué', userBody, {
        url: `${appUrl()}/dashboard`,
        label: 'Découvrir les contenus',
      }),
    })
  }

  // ---- Admin ----
  const adminBody = `
    <p style="margin:0 0 12px;font-size:16px">Un code promo vient d'être utilisé.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#666">Code</td><td style="text-align:right;font-family:monospace;font-weight:600">${esc(params.promoCode)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">User</td><td style="text-align:right">${esc(u.name || '—')} · ${esc(u.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Plan résultant</td><td style="text-align:right;font-weight:600">${esc(params.plan)}</td></tr>
      ${params.bonusLabel ? `<tr><td style="padding:6px 0;color:#666">Bonus</td><td style="text-align:right">${esc(params.bonusLabel)}</td></tr>` : ''}
    </table>
  `
  await send({
    to: SUPPORT_EMAIL,
    subject: `[Laveiye] Promo ${params.promoCode} utilisé par ${u.email}`,
    html: shell('🎁 Code promo utilisé', adminBody),
  })
}

// ---------------------------------------------------------------------------
// 3. Demande suivi de marque
// ---------------------------------------------------------------------------

export async function notifyBrandRequestSubmitted(params: {
  userId: string
  brandName: string
  brandRequestId: string
  brandCountry?: string | null
  brandSector?: string | null
  notes?: string | null
}): Promise<void> {
  const u = await getUserContact(params.userId)
  if (!u?.email) return

  // ---- User ----
  if (!u.email_unsubscribed) {
    const userBody = `
      <p style="margin:0 0 12px;font-size:16px">Bonjour ${esc(u.name || '')},</p>
      <p style="margin:0 0 12px">Nous avons bien reçu votre demande de suivi pour la marque <strong>${esc(params.brandName)}</strong>.</p>
      <p style="margin:0 0 12px">Notre équipe étudie votre demande et reviendra vers vous sous 48h ouvrées avec un devis personnalisé.</p>
    `
    await send({
      to: u.email,
      subject: `📩 Demande reçue — ${params.brandName}`,
      html: shell('Demande reçue', userBody, {
        url: `${appUrl()}/dashboard/brand-requests`,
        label: 'Suivre ma demande',
      }),
    })
  }

  // ---- Admin ----
  const adminBody = `
    <p style="margin:0 0 12px;font-size:16px">Nouvelle demande de suivi de marque.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#666">Marque</td><td style="text-align:right;font-weight:600">${esc(params.brandName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">User</td><td style="text-align:right">${esc(u.name || '—')} · ${esc(u.email)}</td></tr>
      ${params.brandCountry ? `<tr><td style="padding:6px 0;color:#666">Pays</td><td style="text-align:right">${esc(params.brandCountry)}</td></tr>` : ''}
      ${params.brandSector ? `<tr><td style="padding:6px 0;color:#666">Secteur</td><td style="text-align:right">${esc(params.brandSector)}</td></tr>` : ''}
    </table>
    ${params.notes ? `<div style="padding:12px;background:#f5f5f5;border-radius:10px;font-size:13px;color:#444"><strong>Notes :</strong><br>${esc(params.notes).slice(0, 800)}</div>` : ''}
  `
  await send({
    to: SUPPORT_EMAIL,
    subject: `[Laveiye] Demande suivi de marque — ${params.brandName}`,
    html: shell('📩 Nouvelle demande de suivi', adminBody, {
      url: `${appUrl()}/admin/brand-requests`,
      label: 'Traiter la demande',
    }),
  })
}
