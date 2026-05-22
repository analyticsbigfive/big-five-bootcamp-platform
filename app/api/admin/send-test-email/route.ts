import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/gmail-sender'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { ADMIN_EMAILS } from '@/lib/admin-auth'

async function ensureAdmin() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return user.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())
}

const DEFAULT_FROM_EMAIL =
  process.env.GMAIL_FROM || process.env.CONTACT_FROM_EMAIL || 'Laveiye <support@laveiye.com>'

async function getFromEmail() {
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'contact_from_email')
      .maybeSingle<{ value: string | null }>()

    return data?.value || DEFAULT_FROM_EMAIL
  } catch {
    return DEFAULT_FROM_EMAIL
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await ensureAdmin())) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const result = await sendMail({
      from: await getFromEmail(),
      to: email,
      subject: 'Test - Laveiye',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #F2B33D; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Laveiye</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Creative Library</p>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #0F0F0F; margin: 0 0 12px;">Salut ${name || 'there'} !</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Ceci est un email de test envoyé depuis l'administration Laveiye.
              Si tu reçois cet email, le relais Gmail API fonctionne correctement.
            </p>
            <div style="background: #10B981; color: white; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: bold;">
              Gmail API OK
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">
              Envoyé le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      `,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    console.error('Send test email error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
