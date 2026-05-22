/**
 * Templates et helpers d'envoi pour le workflow "Suivi de marques".
 * Envoi via Gmail API (service account + DWD).
 */

import { sendMail } from './gmail-sender'
import { getSupabaseAdmin } from './supabase-server'

const DEFAULT_FROM_EMAIL =
  process.env.GMAIL_FROM || process.env.CONTACT_FROM_EMAIL || 'Laveiye <support@laveiye.com>'

export type BrandEmailKind =
  | 'submission_received'
  | 'quote_sent'
  | 'quote_accepted'
  | 'payment_confirmed'
  | 'in_production'
  | 'completed'
  | 'rejected'
  | 'renewal_reminder'
  | 'cancelled'

interface SendArgs {
  userId: string
  kind: BrandEmailKind
  brandName: string
  context?: {
    adminNotes?: string | null
    devisAmount?: number | null
    devisCurrency?: string | null
    devisUrl?: string | null
    nextRenewalAt?: string | null
    paymentReference?: string | null
  }
}

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

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatAmount(amount?: number | null, currency?: string | null): string {
  if (amount == null) return ''
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'XOF',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency || 'XOF'}`
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

interface TemplateInput {
  userName: string
  brandName: string
  ctaUrl: string
  context: NonNullable<SendArgs['context']>
}

function shell(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#F5F5F5;font-family:Arial,Helvetica,sans-serif;color:#0F0F0F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06);">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #F5F5F5;">
          <strong style="font-size:20px;color:#F2B33D;">LAVEIYE</strong>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F0F0F;">${escapeHtml(title)}</h1>
          ${bodyHtml}
          <div style="margin-top:24px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 24px;background:#F2B33D;color:#fff;font-weight:bold;text-decoration:none;border-radius:10px;">
              ${escapeHtml(ctaLabel)}
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;font-size:12px;color:#666;">
          Vous recevez cet email parce que vous suivez une demande sur Laveiye.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function notesBlock(adminNotes?: string | null): string {
  if (!adminNotes) return ''
  return `<div style="margin-top:16px;padding:14px 16px;background:#FFF7E6;border:1px solid #F2B33D33;border-radius:10px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#b45309;">Note de l'équipe</p>
    <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(adminNotes)}</p>
  </div>`
}

function build({ userName, brandName, ctaUrl, context }: TemplateInput, kind: BrandEmailKind): { subject: string; html: string } {
  const safeName = escapeHtml(userName || '')
  const safeBrand = escapeHtml(brandName)
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,'
  const amount = formatAmount(context.devisAmount, context.devisCurrency)
  const renewal = formatDate(context.nextRenewalAt)

  switch (kind) {
    case 'submission_received': {
      const subject = `Demande de suivi reçue : ${brandName}`
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Nous avons bien reçu votre demande de suivi pour <strong>${safeBrand}</strong>.
          Notre équipe l'analyse et vous fait parvenir un devis personnalisé sous 48h ouvrées.
        </p>
        ${notesBlock(context.adminNotes)}`
      return { subject, html: shell('Demande bien reçue', body, 'Suivre ma demande', ctaUrl) }
    }
    case 'quote_sent': {
      const subject = `Votre devis pour le suivi de ${brandName}`
      const amountBlock = amount
        ? `<div style="margin:16px 0;padding:14px 18px;background:#F5F5F5;border-radius:10px;">
            <p style="margin:0;font-size:13px;color:#555;">Montant du devis</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#0F0F0F;">${escapeHtml(amount)}</p>
          </div>`
        : ''
      const docLink = context.devisUrl
        ? `<p style="margin:8px 0;"><a href="${escapeHtml(context.devisUrl)}" style="color:#F2B33D;">Télécharger le devis (PDF)</a></p>`
        : ''
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Voici votre devis pour le suivi de la marque <strong>${safeBrand}</strong>.
          Connectez-vous à votre espace pour l'accepter ou nous demander une modification.
        </p>
        ${amountBlock}
        ${docLink}
        ${notesBlock(context.adminNotes)}`
      return { subject, html: shell('Votre devis est prêt', body, 'Voir le devis', ctaUrl) }
    }
    case 'quote_accepted': {
      const subject = `Devis accepté — finalisez le paiement pour ${brandName}`
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Merci d'avoir accepté le devis pour <strong>${safeBrand}</strong>.
          Il ne reste plus qu'à finaliser le paiement (${escapeHtml(amount || 'voir devis')}) pour démarrer la production.
        </p>`
      return { subject, html: shell('Devis accepté', body, 'Procéder au paiement', ctaUrl) }
    }
    case 'payment_confirmed': {
      const subject = `Paiement reçu — suivi de ${brandName} en production`
      const ref = context.paymentReference
        ? `<p style="margin:0 0 8px;font-size:13px;color:#666;">Référence : ${escapeHtml(context.paymentReference)}</p>`
        : ''
      const renewalLine = renewal
        ? `<p style="margin:8px 0;font-size:14px;color:#0F0F0F;"><strong>Prochain renouvellement :</strong> ${escapeHtml(renewal)}</p>`
        : ''
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Nous avons bien reçu votre paiement ${amount ? `de <strong>${escapeHtml(amount)}</strong>` : ''} pour le suivi de <strong>${safeBrand}</strong>.
          Notre équipe démarre la production. Vous recevrez les premiers contenus très prochainement.
        </p>
        ${ref}
        ${renewalLine}`
      return { subject, html: shell('Paiement confirmé', body, 'Voir ma demande', ctaUrl) }
    }
    case 'in_production': {
      const subject = `Production lancée pour ${brandName}`
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          La production de votre suivi pour <strong>${safeBrand}</strong> est en cours.
          Nous vous notifierons dès que les premiers contenus seront disponibles dans votre dashboard.
        </p>`
      return { subject, html: shell('Production en cours', body, 'Suivre ma demande', ctaUrl) }
    }
    case 'completed': {
      const subject = `Votre suivi de ${brandName} est disponible`
      const renewalLine = renewal
        ? `<p style="margin:12px 0;font-size:14px;color:#0F0F0F;"><strong>Prochain renouvellement :</strong> ${escapeHtml(renewal)}</p>`
        : ''
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Bonne nouvelle : les contenus du suivi <strong>${safeBrand}</strong> sont disponibles dans votre dashboard.
        </p>
        ${renewalLine}
        ${notesBlock(context.adminNotes)}`
      return { subject, html: shell('Votre suivi est prêt', body, 'Voir les campagnes', ctaUrl) }
    }
    case 'rejected': {
      const subject = `Demande de suivi non retenue : ${brandName}`
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Nous ne pouvons pas donner suite à votre demande pour <strong>${safeBrand}</strong>.
          Vous trouverez ci-dessous les détails de l'équipe.
        </p>
        ${notesBlock(context.adminNotes)}`
      return { subject, html: shell('Demande non retenue', body, 'Faire une nouvelle demande', ctaUrl) }
    }
    case 'renewal_reminder': {
      const subject = `Renouvellement dans 7 jours : ${brandName}`
      const renewalLine = renewal
        ? `<p style="margin:12px 0;font-size:14px;color:#0F0F0F;"><strong>Date de renouvellement :</strong> ${escapeHtml(renewal)}</p>`
        : ''
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Le suivi de la marque <strong>${safeBrand}</strong> sera renouvelé automatiquement dans 7 jours${amount ? ` pour <strong>${escapeHtml(amount)}</strong>` : ''}.
          Vous pouvez résilier ou modifier votre abonnement depuis votre espace.
        </p>
        ${renewalLine}`
      return { subject, html: shell('Renouvellement à venir', body, 'Gérer mon suivi', ctaUrl) }
    }
    case 'cancelled': {
      const subject = `Renouvellement résilié : ${brandName}`
      const body = `<p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Le renouvellement automatique du suivi <strong>${safeBrand}</strong> a bien été désactivé.
          Vous gardez accès aux contenus jusqu'à la fin de la période en cours.
        </p>`
      return { subject, html: shell('Renouvellement résilié', body, 'Voir mes demandes', ctaUrl) }
    }
  }
}

/**
 * Envoie l'email correspondant à un changement de statut.
 * Non bloquant côté appelant : les erreurs sont loggées.
 */
export async function sendBrandRequestEmail(args: SendArgs): Promise<void> {
  if (!process.env.GMAIL_PRIVATE_KEY) {
    console.warn(`[brand-emails] GMAIL_PRIVATE_KEY absent, skip ${args.kind}`)
    return
  }

  const admin = getSupabaseAdmin()

  const { data: userRow } = await admin
    .from('users')
    .select('email, name, email_unsubscribed')
    .eq('id', args.userId)
    .single()

  const email = (userRow as any)?.email
  if (!email) return
  if ((userRow as any)?.email_unsubscribed) return

  const ctaUrl = `${appUrl()}/dashboard/brand-requests`
  const tpl = build(
    {
      userName: (userRow as any)?.name || '',
      brandName: args.brandName,
      ctaUrl,
      context: args.context || {},
    },
    args.kind,
  )

  const from = await getFromEmail()
  const result = await sendMail({
    from,
    to: email,
    subject: tpl.subject,
    html: tpl.html,
  })
  if (!result.ok) {
    console.error(`[brand-emails] send ${args.kind} failed:`, result.error)
  }
}

/**
 * Crée une notification in-app pour un changement de statut.
 */
export async function createBrandRequestNotification(params: {
  userId: string
  brandRequestId: string
  brandName: string
  kind: BrandEmailKind
}): Promise<void> {
  const admin = getSupabaseAdmin()
  const titles: Record<BrandEmailKind, string> = {
    submission_received: `Demande reçue : ${params.brandName}`,
    quote_sent:          `Devis disponible : ${params.brandName}`,
    quote_accepted:      `Devis accepté : ${params.brandName}`,
    payment_confirmed:   `Paiement confirmé : ${params.brandName}`,
    in_production:       `Production lancée : ${params.brandName}`,
    completed:           `Veille concurrentielle prête : ${params.brandName}`,
    rejected:            `Demande non retenue : ${params.brandName}`,
    renewal_reminder:    `Renouvellement dans 7 jours : ${params.brandName}`,
    cancelled:           `Renouvellement résilié : ${params.brandName}`,
  }
  const messages: Record<BrandEmailKind, string> = {
    submission_received: `Votre demande pour ${params.brandName} a bien été enregistrée.`,
    quote_sent:          `Consultez le devis pour ${params.brandName} dans votre espace.`,
    quote_accepted:      `Finalisez le paiement pour démarrer la veille.`,
    payment_confirmed:   `Notre équipe démarre la production de votre veille concurrentielle.`,
    in_production:       `La production de votre veille concurrentielle est en cours.`,
    completed:           `Les campagnes de ${params.brandName} sont disponibles.`,
    rejected:            `Votre demande pour ${params.brandName} n'a pas été retenue.`,
    renewal_reminder:    `Le renouvellement automatique aura lieu dans 7 jours.`,
    cancelled:           `Le renouvellement automatique a été désactivé.`,
  }
  try {
    await admin.from('notifications').insert({
      user_id: params.userId,
      type: `brand_request_${params.kind}`,
      title: titles[params.kind],
      message: messages[params.kind],
      read: false,
      action_url:
        params.kind === 'completed'
          ? `/dashboard?brand=${encodeURIComponent(params.brandName)}`
          : `/dashboard/brand-requests`,
      metadata: { brand_request_id: params.brandRequestId, brand_name: params.brandName },
    } as any)
  } catch (e) {
    console.error('[brand-emails] notification insert failed:', e)
  }
}
