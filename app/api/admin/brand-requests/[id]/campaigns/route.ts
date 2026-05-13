/**
 * API admin : gestion des campagnes attachées à une demande de suivi de marque.
 *
 * Remplace l'association automatique (par tags / pays / secteurs / plateformes)
 * par un rattachement 100% manuel géré par l'équipe LAVEIYE.
 *
 *   GET  /api/admin/brand-requests/[id]/campaigns
 *        → { campaigns: Campaign[] }  (campagnes actuellement rattachées)
 *
 *   PUT  /api/admin/brand-requests/[id]/campaigns
 *        body: { campaignIds: string[] }
 *        → synchronise la liste (ajoute les nouveaux, retire les absents)
 *
 *   POST /api/admin/brand-requests/[id]/campaigns
 *        body: { campaignId: string }
 *        → ajoute une campagne (idempotent)
 *
 *   DELETE /api/admin/brand-requests/[id]/campaigns?campaignId=...
 *        → retire une campagne
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { checkAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

async function loadRequest(admin: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data, error } = await admin
    .from('brand_requests')
    .select('id')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const admin = getSupabaseAdmin()
  const req = await loadRequest(admin, id)
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

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
    return NextResponse.json({ campaigns: [] })
  }

  const { data: campaigns, error: campErr } = await admin
    .from('campaigns')
    .select('*')
    .in('id', ids)

  if (campErr) {
    return NextResponse.json({ error: campErr.message }, { status: 500 })
  }

  // Conserver l'ordre des liens (les plus récents d'abord)
  const byId = new Map((campaigns || []).map((c: any) => [c.id, c]))
  const ordered = ids.map((cid) => byId.get(cid)).filter(Boolean)

  return NextResponse.json({ campaigns: ordered })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await request.json().catch(() => ({} as any))
  const campaignIds: string[] = Array.isArray(body?.campaignIds)
    ? Array.from(new Set(body.campaignIds.map((x: any) => String(x)).filter(Boolean)))
    : []

  const admin = getSupabaseAdmin()
  const req = await loadRequest(admin, id)
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  // Diff avec l'existant
  const { data: existing, error: exErr } = await admin
    .from('brand_request_campaigns')
    .select('campaign_id')
    .eq('brand_request_id', id)

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  const existingIds = new Set((existing || []).map((l: any) => l.campaign_id))
  const targetIds = new Set(campaignIds)

  const toAdd = campaignIds.filter((cid) => !existingIds.has(cid))
  const toRemove = Array.from(existingIds).filter((cid) => !targetIds.has(cid))

  if (toAdd.length > 0) {
    const rows = toAdd.map((cid) => ({
      brand_request_id: id,
      campaign_id: cid,
      added_by: adminUser.id,
    }))
    const { error } = await admin.from('brand_request_campaigns').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (toRemove.length > 0) {
    const { error } = await admin
      .from('brand_request_campaigns')
      .delete()
      .eq('brand_request_id', id)
      .in('campaign_id', toRemove)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ added: toAdd.length, removed: toRemove.length })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await request.json().catch(() => ({} as any))
  const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : ''
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId requis' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const req = await loadRequest(admin, id)
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const { error } = await admin.from('brand_request_campaigns').upsert(
    { brand_request_id: id, campaign_id: campaignId, added_by: adminUser.id },
    { onConflict: 'brand_request_id,campaign_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId')?.trim()
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId requis' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('brand_request_campaigns')
    .delete()
    .eq('brand_request_id', id)
    .eq('campaign_id', campaignId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
