import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const forceDownload = request.nextUrl.searchParams.get('download') === '1'
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Récupérer le paiement
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!adminUrl || !adminKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }
    const supabaseAdmin = createClient(adminUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('user_email', user.email)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 })
    }

    // Récupérer le profil utilisateur
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single()

    const userName = profile?.name || user.email || "Utilisateur"
    const userEmail = profile?.email || user.email || ""
    const paymentDate = new Date(payment.created_at).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric"
    })
    const paymentTime = new Date(payment.created_at).toLocaleTimeString("fr-FR", {
      hour: "2-digit", minute: "2-digit"
    })

    // Détails de l'abonnement : plan + date de validité
    const meta = (payment.metadata || {}) as Record<string, any>
    const planLabel: string =
      meta.plan_label ||
      (meta.plan ? String(meta.plan).charAt(0).toUpperCase() + String(meta.plan).slice(1) : "Abonnement")
    const billingLabel = meta.billing === 'annual'
      ? 'annuel'
      : meta.billing === 'promo3m'
        ? '3 mois (offre)'
        : 'mensuel'
    const planDescription = `Abonnement ${planLabel} (${billingLabel})`

    const endDateRaw = meta.subscription_end_date || null
    const validityDate = endDateRaw
      ? new Date(endDateRaw).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : null

    // Générer le reçu en HTML
    const receiptHTML = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reçu de paiement - ${payment.ref_command}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F0F0F; background: #f8f9fa; padding: 40px; }
    .receipt { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #F2B33D; padding: 32px; text-align: center; color: #0F0F0F; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 14px; opacity: 0.85; }
    .badge { display: inline-block; margin-top: 16px; background: rgba(255,255,255,0.2); border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 600; }
    .body { padding: 32px; }
    .status { text-align: center; margin-bottom: 24px; }
    .status .icon { font-size: 40px; margin-bottom: 8px; }
    .status .text { font-size: 18px; font-weight: 700; color: #10B981; }
    .divider { height: 1px; background: #E5E7EB; margin: 24px 0; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; }
    .row .label { color: #6B7280; font-weight: 500; }
    .row .value { font-weight: 600; text-align: right; }
    .total { background: #F3F4F6; border-radius: 12px; padding: 16px; margin-top: 16px; }
    .total .row { font-size: 16px; }
    .total .row .value { color: #F2B33D; font-size: 20px; font-weight: 800; }
    .footer { padding: 24px 32px; background: #F9FAFB; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
    .footer a { color: #F2B33D; text-decoration: none; }
    @media print { body { padding: 0; background: white; } .receipt { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Laveiye</h1>
      <p>Reçu de paiement</p>
      <div class="badge">N° ${payment.ref_command}</div>
    </div>
    <div class="body">
      <div class="status">
        <div class="icon">✅</div>
        <div class="text">Paiement confirmé</div>
      </div>
      <div class="divider"></div>
      <div class="row">
        <span class="label">Client</span>
        <span class="value">${userName}</span>
      </div>
      <div class="row">
        <span class="label">Email</span>
        <span class="value">${userEmail}</span>
      </div>
      <div class="row">
        <span class="label">Date</span>
        <span class="value">${paymentDate} à ${paymentTime}</span>
      </div>
      <div class="row">
        <span class="label">Référence</span>
        <span class="value">${payment.ref_command}</span>
      </div>
      <div class="row">
        <span class="label">Méthode</span>
        <span class="value">${payment.payment_method || "Mobile Money"}</span>
      </div>
      <div class="row">
        <span class="label">Statut</span>
        <span class="value" style="color: #10B981;">Complété</span>
      </div>
      <div class="row">
        <span class="label">Description</span>
        <span class="value">${planDescription}</span>
      </div>
      ${validityDate ? `<div class="row">
        <span class="label">Valable jusqu'au</span>
        <span class="value">${validityDate}</span>
      </div>` : ''}
      <div class="total">
        <div class="row">
          <span class="label">Montant total</span>
          <span class="value">${(payment.amount || 0).toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Laveiye — Bibliothèque de campagnes publicitaires africaines</p>
      <p style="margin-top: 8px;">Ce document fait office de reçu de paiement.</p>
      <p style="margin-top: 4px;">Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
    </div>
  </div>
</body>
</html>`

    return new NextResponse(receiptHTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${forceDownload ? 'attachment' : 'inline'}; filename="recu-${payment.ref_command}.html"`,
      },
    })
  } catch (error) {
    console.error("Receipt generation error:", error)
    return NextResponse.json({ error: "Erreur lors de la génération du reçu" }, { status: 500 })
  }
}
