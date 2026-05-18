/**
 * POST /api/admin/decrypte/delete
 * Suppression d'inscriptions #BigFiveDecrypte par ids.
 * Body : { ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) {
    return NextResponse.json(
      { error: 'Acces reserve aux administrateurs' },
      { status: 403 }
    )
  }

  let body: { ids?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body */
  }

  if (!Array.isArray(body.ids) || !body.ids.length) {
    return NextResponse.json({ error: 'Parametre ids requis' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('decrypte_registrations')
    .delete()
    .in('id', body.ids)

  if (error) {
    console.error('[admin/decrypte/delete] error:', error)
    return NextResponse.json(
      { error: (error as { message?: string }).message || 'Erreur DB' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, deleted: body.ids.length })
}
