import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

/**
 * Génère un slug SEO-friendly à partir d'un titre (côté serveur)
 */
function generateSlugFromTitle(text: string): string {
  if (!text) return ''
  const accentMap: Record<string, string> = {
    'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a', 'ã': 'a',
    'è': 'e', 'ê': 'e', 'ë': 'e', 'é': 'e',
    'ì': 'i', 'î': 'i', 'ï': 'i', 'í': 'i',
    'ò': 'o', 'ô': 'o', 'ö': 'o', 'ó': 'o', 'õ': 'o',
    'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
    'ñ': 'n', 'ç': 'c', 'ß': 'ss',
  }
  return text
    .toLowerCase()
    .split('')
    .map(char => accentMap[char] || char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 250)
}

// Liste des emails admin autorisés (centralisée)
const ADMIN_EMAILS = [
  'jeanluc@bigfiveabidjan.com', 
  'cossi@bigfiveabidjan.com', 
  'yannick@bigfiveabidjan.com', 
  'franck@bigfiveabidjan.com', 
  'stephanie@bigfiveabidjan.com'
]

// Helper pour vérifier si l'utilisateur est admin
async function isAdminUser(request: NextRequest): Promise<{ isAdmin: boolean; email?: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return allCookies
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Ignore errors in read-only context
            }
          },
        },
      }
    )
    
    // Utiliser getUser() qui est plus fiable que getSession() côté serveur
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      return { isAdmin: false, error: error.message }
    }

    if (!user?.email) {
      return { isAdmin: false, error: 'No user session' }
    }

    if (user.app_metadata?.role === 'admin' || ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return { isAdmin: true, email: user.email }
    }

    return { isAdmin: false, email: user.email, error: 'Not an admin' }
  } catch (error: any) {
    return { isAdmin: false, error: error.message }
  }
}

/**
 * GET /api/admin/campaigns
 * Récupère toutes les campagnes (admin only, bypass RLS)
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est admin
    const { isAdmin } = await isAdminUser(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Utiliser le client admin (service_role) pour bypass RLS
    const supabaseAdmin = getSupabaseAdmin()
    
    const { data, error } = await (supabaseAdmin as any)
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: error.message, campaigns: [] }, { status: 500 })
    }
    
    return NextResponse.json({ campaigns: data || [] })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message, campaigns: [] }, { status: 500 })
  }
}

/**
 * POST /api/admin/campaigns
 * Créer une nouvelle campagne (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await isAdminUser(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const supabaseAdmin = getSupabaseAdmin()
    
    // S'assurer qu'il y a un statut par défaut
    if (!body.status) {
      body.status = 'Brouillon'
    }
    
    // Auto-générer le slug s'il n'est pas fourni
    if (!body.slug && body.title) {
      body.slug = generateSlugFromTitle(body.title)
      
      // Vérifier l'unicité du slug et ajouter un suffixe si nécessaire
      let slugCandidate = body.slug
      let counter = 2
      while (true) {
        const { data: existing } = await (supabaseAdmin as any)
          .from('campaigns')
          .select('id')
          .eq('slug', slugCandidate)
          .maybeSingle()
        
        if (!existing) break
        slugCandidate = `${body.slug}-${counter}`
        counter++
      }
      body.slug = slugCandidate
    }
    
    const { data, error } = await (supabaseAdmin as any)
      .from('campaigns')
      .insert(body)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ campaign: data })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/admin/campaigns
 * Mettre à jour une campagne (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await isAdminUser(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }
    
    const supabaseAdmin = getSupabaseAdmin()
    
    // Si le slug est modifié, vérifier l'unicité
    if (updateData.slug) {
      let slugCandidate = updateData.slug
      let counter = 2
      while (true) {
        const { data: existing } = await (supabaseAdmin as any)
          .from('campaigns')
          .select('id')
          .eq('slug', slugCandidate)
          .neq('id', id)
          .maybeSingle()
        
        if (!existing) break
        slugCandidate = `${updateData.slug}-${counter}`
        counter++
      }
      updateData.slug = slugCandidate
    }
    
    const { data, error } = await (supabaseAdmin as any)
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ campaign: data })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/campaigns
 * Supprimer une campagne (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await isAdminUser(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }
    
    const supabaseAdmin = getSupabaseAdmin()
    
    const { error } = await (supabaseAdmin as any)
      .from('campaigns')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
