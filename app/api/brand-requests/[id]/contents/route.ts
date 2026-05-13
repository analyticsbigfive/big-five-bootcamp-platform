/**
 * GET /api/brand-requests/[id]/contents
 *
 * Renvoie les campagnes manuellement rattachées par l'équipe admin à cette
 * demande de suivi (table de liaison `brand_request_campaigns`).
 *
 * Plus d'association automatique par pays / secteurs / plateformes : c'est
 * l'admin qui décide explicitement, dans /admin/brand-requests, quelles
 * campagnes apparaissent ici.
 *
 * La demande doit appartenir à l'utilisateur connecté, être approuvée
 * (status='completed') et payée (paid_at non null).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  try {
    const supabase = await getSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: req, error } = await admin
      .from('brand_requests')
      .select('id, user_id, brand_name, status, paid_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !req) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    }

    // SÉCURITÉ COMMERCIALE : l'accès aux contenus exige
    //   status='completed' (« Disponible ») ET paid_at non null.
    const isPaid = !!(req as any).paid_at
    if (req.status !== 'completed' || !isPaid) {
      return NextResponse.json({ contents: [], status: req.status, paid: isPaid })
    }

    // Campagnes manuellement rattachées par l'admin
    const { data: links, error: linksErr } = await admin
      .from('brand_request_campaigns')
      .select('campaign_id, added_at')
      .eq('brand_request_id', id)
      .order('added_at', { ascending: false })

    if (linksErr) {
      return NextResponse.json({ error: linksErr.message }, { status: 500 })
    }

    const ids = (links || []).map((l: any) => l.campaign_id)
    if (ids.length === 0) {
      return NextResponse.json({ contents: [], status: req.status })
    }

    const { data: campaigns } = await admin
      .from('campaigns')
      .select('*')
      .in('id', ids)
      .eq('status', 'Publié')

    // Conserver l'ordre des rattachements (les plus récents d'abord)
    const byId = new Map((campaigns || []).map((c: any) => [c.id, c]))
    const ordered = ids.map((cid) => byId.get(cid)).filter(Boolean)

    return NextResponse.json({ contents: ordered, status: req.status })
  } catch (e: any) {
    console.error('[brand-requests/:id/contents]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
