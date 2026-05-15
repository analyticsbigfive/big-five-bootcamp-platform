/**
 * GET /api/avatars?limit=4
 *
 * Liste publique d'avatars d'utilisateurs (URL de photo de profil uniquement).
 * Utilisé sur les pages register/login pour le "social proof" visuel.
 * Ne retourne que les profils ayant un `avatar_url` non vide.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 4), 20)
    const admin = getSupabaseAdmin()

    const collected: { url: string; name: string }[] = []
    const seen = new Set<string>()

    // 1) Source : public.users.avatar_url (si la colonne existe).
    //    On capture l'erreur "column does not exist" pour ne pas planter
    //    quand la migration n'a pas encore été appliquée.
    try {
      const { data, error } = await (admin as any)
        .from('users')
        .select('avatar_url, name')
        .not('avatar_url', 'is', null)
        .neq('avatar_url', '')
        .limit(limit)
      if (!error) {
        for (const u of (data || [])) {
          if (u.avatar_url && !seen.has(u.avatar_url)) {
            seen.add(u.avatar_url)
            collected.push({ url: u.avatar_url, name: u.name || '' })
          }
        }
      }
    } catch {
      // ignore — la colonne avatar_url peut ne pas exister encore
    }

    // 2) Fallback : auth.users.user_metadata.avatar_url (ou .picture pour OAuth).
    //    Utile tant que la migration scripts/add-avatar-url-to-users.sql n'est
    //    pas jouée — l'avatar uploadé via /profile vit en double dans
    //    user_metadata, donc on peut le récupérer ici.
    if (collected.length < limit) {
      try {
        const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        for (const u of (authList?.users || [])) {
          if (collected.length >= limit) break
          const meta: any = u.user_metadata || {}
          const url = meta.avatar_url || meta.picture
          if (url && !seen.has(url)) {
            seen.add(url)
            collected.push({ url, name: meta.name || u.email || '' })
          }
        }
      } catch (e) {
        console.error('[api/avatars] listUsers erreur:', e)
      }
    }

    return NextResponse.json({ avatars: collected.slice(0, limit) })
  } catch (err) {
    console.error('[api/avatars] exception:', err)
    return NextResponse.json({ avatars: [] })
  }
}
