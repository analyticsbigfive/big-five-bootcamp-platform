import { NextRequest, NextResponse } from 'next/server'
import { getMailchimpService } from '@/lib/mailchimp'

// POST — Synchroniser les utilisateurs avec l'audience Mailchimp
export async function POST(request: NextRequest) {
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
    await service.loadConfig()
    const result = await service.syncUsersWithAudience()

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Mailchimp sync error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
