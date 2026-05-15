import { NextRequest, NextResponse } from 'next/server'
import { getMailchimpService } from '@/lib/mailchimp'

// GET — Récupérer les métadonnées de la Creative Library
export async function GET() {
  try {
    // Vérifier l'authentification admin
    const { getSupabaseServer } = await import('@/lib/supabase-server')
    const supabaseServer = await getSupabaseServer()
    const { data: { user } } = await supabaseServer.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { ADMIN_EMAILS } = await import('@/lib/admin-auth')
    const isAdmin = user.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())

    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const service = getMailchimpService()
    const metadata = await service.getLibraryMetadata()

    return NextResponse.json({ success: true, metadata })
  } catch (err: any) {
    console.error('Mailchimp metadata error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
