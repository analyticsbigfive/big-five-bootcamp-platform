/**
 * API Route: POST /api/subscription/expire-self
 *
 * Auto-expiration : appelée par le client quand il détecte que sa propre
 * subscription_end_date est dans le passé. Bascule plan=null,
 * subscription_status='expired'. Auth Supabase requise — l'utilisateur
 * ne peut expirer que son propre profil.
 */

import { NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: profile, error: readErr } = await (admin as any)
      .from('users')
      .select('id, plan, subscription_status, subscription_end_date')
      .eq('id', user.id)
      .single()
    if (readErr || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const end = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null
    const expired = !!end && end < new Date()
    if (!expired) {
      return NextResponse.json({ ok: true, changed: false })
    }

    const { error: updErr } = await (admin as any)
      .from('users')
      .update({
        plan: null,
        subscription_status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, changed: true })
  } catch (err: any) {
    console.error('[expire-self] erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
