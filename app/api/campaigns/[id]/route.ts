export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-auth'
import { getViewerAccess, projectCampaign } from '@/lib/content-access'

/**
 * GET /api/campaigns/[id]
 * Récupérer une campagne par son ID.
 * Authentification requise : le contenu n'est jamais servi à un visiteur anonyme.
 * Les non-admins ne voient que les campagnes publiées et sans champs premium.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await getViewerAccess()
    if (!viewer.isAuthenticated) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    // Dans Next.js 15+, params est une Promise
    const { id } = await params;

    const { data, error } = await (supabaseAdmin as any)
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    // Les non-admins ne peuvent pas accéder aux brouillons / contenus non publiés.
    if (!viewer.isAdmin && data.status !== 'Publié') {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    return NextResponse.json(projectCampaign(data, viewer))
  } catch (error: any) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Mettre à jour une campagne (admin uniquement).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Écriture admin uniquement : supabaseAdmin contourne RLS, donc on doit
    // vérifier l'autorisation ici (le middleware n'intercepte pas /api).
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    // Dans Next.js 15+, params est une Promise
    const { id } = await params;
    const body = await request.json()

    const { data, error } = await (supabaseAdmin as any)
      .from('campaigns')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Supprimer une campagne (admin uniquement).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Suppression admin uniquement (supabaseAdmin contourne RLS).
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    // Dans Next.js 15+, params est une Promise
    const { id } = await params;

    const { error } = await (supabaseAdmin as any)
      .from('campaigns')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
