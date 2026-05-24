/**
 * API Route: GET /api/users/[id]/favorites
 *
 * Récupère les campagnes favorites d'un utilisateur.
 * Auth requise : seul l'utilisateur lui-même OU un admin peut accéder
 * aux favoris (les favoris ne sont pas un profil public).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';
import { ADMIN_EMAILS } from '@/lib/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth obligatoire : empêche un visiteur anonyme de lister les favoris
    // d'un autre utilisateur (IDOR).
    const supabaseServer = await getSupabaseServer();
    const { data: { user: authUser } } = await supabaseServer.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const isAdmin =
      authUser.app_metadata?.role === 'admin' ||
      ADMIN_EMAILS.includes((authUser.email || '').toLowerCase());

    if (authUser.id !== id && !isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Vérifier que l'utilisateur existe
    const { data: user, error: userError } = await (supabaseAdmin as any)
      .from('users')
      .select('id, name')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Récupérer les favoris avec les détails des campagnes
    const { data: favorites, error: favError } = await (supabaseAdmin as any)
      .from('favorites')
      .select(`
        id,
        campaign_id,
        created_at,
        campaign:campaigns (
          id,
          title,
          thumbnail,
          platforms,
          category,
          format,
          description,
          brand,
          country,
          access_level
        )
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (favError) {
      console.error('Erreur récupération favoris:', favError.message);
      return NextResponse.json({ favorites: [], user: { name: user.name } });
    }

    const formattedFavorites = (favorites || [])
      .filter((f: any) => f.campaign)
      .map((f: any) => ({
        id: f.campaign.id,
        title: f.campaign.title,
        thumbnail: f.campaign.thumbnail,
        platforms: f.campaign.platforms,
        category: f.campaign.category,
        format: f.campaign.format,
        brand: f.campaign.brand,
        country: f.campaign.country,
        accessLevel: f.campaign.access_level || 'free',
        addedAt: f.created_at,
      }));

    return NextResponse.json({
      user: { name: user.name },
      favorites: formattedFavorites,
      total: formattedFavorites.length,
    });
  } catch (error) {
    console.error('Erreur API users/[id]/favorites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
