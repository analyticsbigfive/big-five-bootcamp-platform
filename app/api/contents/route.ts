import { NextResponse } from "next/server"
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/supabase-server"
import { z } from "zod"

export const dynamic = 'force-dynamic';

// Schéma de validation
const contentCreateSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal("")),
  video_url: z.string().url().optional().or(z.literal("")),
  brand: z.string().optional(),
  category: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["Publié", "Brouillon", "En attente"]).optional(),
})

// GET - Liste des contenus/campagnes avec filtres
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const search = searchParams.get("search") || ""
    const brand = searchParams.get("brand")
    const category = searchParams.get("category")
    const platform = searchParams.get("platform")
    const status = searchParams.get("status")

    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Vérifier si admin ou non
    const currentUser = await getAuthenticatedUser()
    if (!currentUser || !currentUser.isAdmin) {
      query = query.eq('status', 'Publié')
    } else if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      const { escapeForIlike } = await import('@/lib/search-utils')
      const s = escapeForIlike(search)
      if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,brand.ilike.%${s}%`)
    }
    if (brand) {
      const { escapeForIlike } = await import('@/lib/search-utils')
      const b = escapeForIlike(brand)
      if (b) query = query.ilike('brand', `%${b}%`)
    }
    if (category) query = query.eq('category', category)
    if (platform) query = query.contains('platforms', [platform])

    const { data: contents, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      contents: contents || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error("Contents GET error:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

// POST - Créer un contenu (admin uniquement)
export async function POST(request: Request) {
  try {
    const currentUser = await getAuthenticatedUser()
    
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = contentCreateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const data = validation.data

    const { data: content, error } = await supabase
      .from('campaigns')
      .insert({
        title: data.title,
        description: data.description || null,
        thumbnail: data.thumbnail || null,
        video_url: data.video_url || null,
        brand: data.brand || null,
        category: data.category || null,
        platforms: data.platforms || [],
        tags: data.tags || [],
        status: data.status || 'Brouillon',
        author_id: currentUser.id,
        author_name: currentUser.profile?.name || currentUser.email,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ content }, { status: 201 })

  } catch (error) {
    console.error("Contents POST error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    )
  }
}
