import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/gmail-sender'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const DEFAULT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'support@laveiye.com'
const DEFAULT_FROM_EMAIL =
  process.env.GMAIL_FROM || process.env.CONTACT_FROM_EMAIL || 'Laveiye <support@laveiye.com>'

// Cc permanent sur chaque message de contact (équipe Big Five).
const CONTACT_CC = [
  'cossi@bigfiveabidjan.com',
  'yannick@bigfiveabidjan.com',
  'jeanluc@bigfiveabidjan.com',
]

// Récupérer les adresses email depuis Supabase (configurable depuis l'admin)
async function getContactEmails() {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['contact_to_email', 'contact_from_email'])

    const settings: Record<string, string> = {}
    data?.forEach((row: { key: string; value: string }) => {
      settings[row.key] = row.value
    })

    return {
      to: settings.contact_to_email || DEFAULT_TO_EMAIL,
      from: settings.contact_from_email || DEFAULT_FROM_EMAIL,
    }
  } catch {
    return { to: DEFAULT_TO_EMAIL, from: DEFAULT_FROM_EMAIL }
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`contact:${ip}`, 5, 5 * 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    }

    const { firstName, lastName, email, message, website } = await request.json()

    // Honeypot anti-bot : champ "website" doit être vide
    if (website && String(website).trim().length > 0) {
      return NextResponse.json({ success: true })
    }

    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      )
    }

    // Limites de taille pour bloquer payloads massifs
    if (message.length > 5000 || firstName.length > 100 || lastName.length > 100) {
      return NextResponse.json({ error: 'Champs trop longs' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      )
    }

    if (!process.env.GMAIL_PRIVATE_KEY) {
      console.error('GMAIL_PRIVATE_KEY non configurée')
      return NextResponse.json(
        { error: 'Service email non configuré' },
        { status: 500 }
      )
    }

    const contactEmails = await getContactEmails()

    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    const fn = esc(firstName)
    const ln = esc(lastName)
    const em = esc(email)
    const msg = esc(message)

    // 1. Email principal à l'équipe
    const result = await sendMail({
      from: contactEmails.from,
      to: contactEmails.to,
      cc: CONTACT_CC,
      replyTo: email,
      subject: `Nouveau message de ${fn} ${ln}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #F2B33D; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Laveiye</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Nouveau message de contact</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #0F0F0F; margin: 0 0 16px;">Message de ${fn} ${ln}</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr>
                <td style="padding: 8px 12px; background: #e5e7eb; border-radius: 6px 0 0 0; font-weight: 600; color: #374151; width: 100px;">Nom</td>
                <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 0 6px 0 0; color: #4b5563;">${fn} ${ln}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #e5e7eb; font-weight: 600; color: #374151;">Email</td>
                <td style="padding: 8px 12px; background: #f3f4f6; color: #4b5563;"><a href="mailto:${em}" style="color: #F2B33D;">${em}</a></td>
              </tr>
            </table>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 12px;">
              <p style="color: #374151; font-weight: 600; margin: 0 0 8px;">Message :</p>
              <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${msg}</p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">
              Reçu le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      `,
    })

    if (!result.ok) {
      console.error('Gmail send error:', result.error)
      return NextResponse.json(
        { error: "Erreur lors de l'envoi de l'email" },
        { status: 500 }
      )
    }

    // 2. Accusé de réception à l'expéditeur (non bloquant)
    try {
      await sendMail({
        from: contactEmails.from,
        to: email,
        subject: 'Confirmation : nous avons bien reçu votre message',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #F2B33D; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Laveiye</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Accusé de réception</p>
            </div>
            <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #0F0F0F; margin: 0 0 16px;">Merci ${fn} !</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.
              </p>
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="color: #374151; font-weight: 600; margin: 0 0 8px;">Récapitulatif de votre message :</p>
                <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${msg}</p>
              </div>
              <p style="color: #4b5563; line-height: 1.6; margin: 16px 0 0;">
                À très bientôt,<br />
                <strong>L'équipe Laveiye</strong>
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Cet email est un accusé de réception automatique. Merci de ne pas y répondre directement.
              </p>
            </div>
          </div>
        `,
      })
    } catch (confirmError) {
      console.error('Erreur envoi accusé de réception:', confirmError)
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
