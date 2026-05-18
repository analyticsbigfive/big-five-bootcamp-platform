import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

async function getAuthenticatedAdmin() {
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
  if (!user) return null

  // Vérifier que l'utilisateur est admin
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) {
    // Misconfig serveur — fail-safe. Le caller voit "non autorisé" plutôt
    // que de remonter un détail de config.
    return null
  }
  const supabaseAdmin = createClient(adminUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null

  return { user, supabaseAdmin }
}

// GET — Lister les demandes d'annulation (admin uniquement)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"

    const { data: requests, error } = await auth.supabaseAdmin
      .from('subscription_cancellation_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error("Error fetching cancellation requests:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST — Traiter une demande d'annulation (admin uniquement)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin()
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, action, adminNotes } = body

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId et action requis" }, { status: 400 })
    }

    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Action invalide (approved ou rejected)" }, { status: 400 })
    }

    // Récupérer la demande
    const { data: cancellationRequest, error: fetchError } = await auth.supabaseAdmin
      .from('subscription_cancellation_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !cancellationRequest) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 })
    }

    // Mettre à jour le statut de la demande
    const { error: updateError } = await auth.supabaseAdmin
      .from('subscription_cancellation_requests')
      .update({
        status: action === "approved" ? "processed" : "rejected",
        admin_notes: adminNotes || null,
        processed_by: auth.user.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Si approuvé, annuler l'abonnement de l'utilisateur
    if (action === "approved") {
      const { error: userUpdateError } = await auth.supabaseAdmin
        .from('users')
        .update({
          subscription_status: "cancelled",
          plan: null,
        })
        .eq('id', cancellationRequest.user_id)

      if (userUpdateError) {
        console.error("Erreur mise à jour utilisateur:", userUpdateError)
      }

      // Créer une notification pour l'utilisateur
      try {
        await auth.supabaseAdmin
          .from('notifications')
          .insert({
            user_id: cancellationRequest.user_id,
            title: "Abonnement annulé",
            message: "Votre demande d'annulation d'abonnement a été traitée. Souscrivez à un plan pour continuer à utiliser la plateforme.",
            type: "subscription",
            read: false,
          })
      } catch {
        // Ignorer si la table notifications n'existe pas
      }
    }

    return NextResponse.json({
      success: true,
      message: action === "approved" 
        ? "Abonnement annulé avec succès" 
        : "Demande d'annulation refusée",
    })
  } catch (error) {
    console.error("Error processing cancellation request:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
