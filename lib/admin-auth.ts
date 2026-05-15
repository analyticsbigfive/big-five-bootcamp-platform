/**
 * Helper : verification admin uniforme pour les routes /api/admin/*
 * Accepte l'admin si l'une des conditions est remplie :
 *   - user_metadata.role === 'admin'
 *   - email dans la liste ADMIN_EMAILS
 *   - row users.role === 'admin'
 */

import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'

/**
 * Liste d'emails admin. Source de vérité :
 *   1. variable d'env ADMIN_EMAILS (séparée par virgules) si définie
 *   2. fallback codé en dur pour ne pas perdre l'accès si la variable manque
 *
 * Pour rotation : éditer la variable d'env Vercel sans redéploiement de code.
 */
const FALLBACK_ADMIN_EMAILS = [
  'jeanluc@bigfiveabidjan.com',
  'cossi@bigfiveabidjan.com',
  'yannick@bigfiveabidjan.com',
  'franck@bigfiveabidjan.com',
  'stephanie@bigfiveabidjan.com',
]

export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)
  .length > 0
  ? (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  : FALLBACK_ADMIN_EMAILS

export async function checkAdmin(): Promise<User | null> {
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // 1) metadata
  if ((user.user_metadata as any)?.role === 'admin') return user
  // 2) liste blanche email (case-insensitive)
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return user

  // 3) role en BDD (fallback)
  try {
    const admin = getSupabaseAdmin()
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if ((profile as any)?.role === 'admin') return user
  } catch {
    /* ignore */
  }

  return null
}
