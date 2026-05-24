import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/gmail-sender'
import { getSupabaseAdmin, getSupabaseServer } from '@/lib/supabase-server'
import { ADMIN_EMAILS } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEAM_RECIPIENTS = [
  'cossi@bigfiveabidjan.com',
  'jeremie@bigfiveparis.com',
  'yannick@bigfiveabidjan.com',
  'jeanluc@bigfiveabidjan.com',
]

async function ensureAdmin() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return user.app_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())
}

function esc(input: string | null | undefined): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
    if (!(await ensureAdmin())) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const { brandRequestId, message } = await request.json() as { brandRequestId: string; message?: string }
    if (!brandRequestId) {
      return NextResponse.json({ error: 'brandRequestId requis' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: req, error } = await admin
      .from('brand_requests')
      .select('id, brand_name, brand_country, brand_sector, status, notes, admin_notes, created_at, user_id')
      .eq('id', brandRequestId)
      .single()

    if (error || !req) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    }

    let userInfo: { name?: string; email?: string } = {}
    if ((req as any).user_id) {
      const { data: u } = await admin
        .from('users')
        .select('name, email')
        .eq('id', (req as any).user_id)
        .maybeSingle<{ name: string; email: string }>()
      if (u) userInfo = u
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://laveiye.com').replace(/\/$/, '')
    const r = req as any

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif;color:#0f0f0f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#80368D,#a855f7);color:#fff">
          <h1 style="margin:0;font-size:20px;font-weight:700">🔔 Notification équipe — Demande de suivi de marque</h1>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6">L'admin requiert l'attention de l'équipe sur cette demande :</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">Marque</td><td style="font-weight:600">${esc(r.brand_name)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Statut</td><td style="font-weight:600">${esc(r.status)}</td></tr>
            ${r.brand_country ? `<tr><td style="padding:8px 0;color:#666">Pays</td><td>${esc(r.brand_country)}</td></tr>` : ''}
            ${r.brand_sector ? `<tr><td style="padding:8px 0;color:#666">Secteur</td><td>${esc(r.brand_sector)}</td></tr>` : ''}
            ${userInfo.email ? `<tr><td style="padding:8px 0;color:#666">Client</td><td>${esc(userInfo.name || '')} · ${esc(userInfo.email)}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666">Créée le</td><td>${esc(new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }))}</td></tr>
          </table>
          ${r.notes ? `<div style="margin:16px 0;padding:14px;background:#f9fafb;border-radius:10px;font-size:13px;color:#444"><strong>Notes client :</strong><br>${esc(r.notes)}</div>` : ''}
          ${message ? `<div style="margin:16px 0;padding:14px;background:#fff7e6;border:1px solid #F2B33D33;border-radius:10px;font-size:14px"><strong>Message de l'admin :</strong><br>${esc(message)}</div>` : ''}
          <div style="margin-top:24px"><a href="${appUrl}/admin/brand-requests" style="display:inline-block;background:#80368D;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Voir dans l'admin</a></div>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;color:#666;font-size:12px">
          Laveiye Admin · Notification interne équipe
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    const result = await sendMail({
      to: TEAM_RECIPIENTS,
      subject: `[Laveiye Admin] Notification équipe — ${r.brand_name}`,
      html,
    })

    if (!result.ok) {
      console.error('[notify-team] send failed:', result.error)
      return NextResponse.json({ error: result.error || 'Erreur envoi email' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: result.id, recipients: TEAM_RECIPIENTS })
  } catch (err) {
    console.error('[notify-team] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
