import { NextResponse } from "next/server"
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/supabase-server"
import { z } from "zod"

export const dynamic = 'force-dynamic';

// Schéma de validation
const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["user", "admin"]).optional(),
  plan: z.enum(["Discovery", "Basic", "Pro"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

// GET - Liste des utilisateurs (admin uniquement)
export async function GET(request: Request) {
  try {
    const currentUser = await getAuthenticatedUser()
    
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const role = searchParams.get("role")
    const plan = searchParams.get("plan")
    const status = searchParams.get("status")

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (search) {
      const { escapeForIlike } = await import('@/lib/search-utils')
      const s = escapeForIlike(search)
      if (s) query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`)
    }
    if (role) query = query.eq('role', role)
    if (plan) query = query.eq('plan', plan)
    if (status) query = query.eq('status', status)

    const { data: users, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error("Users GET error:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

// POST - Créer un utilisateur (admin uniquement)
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
    const validation = userCreateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, role, plan, status } = validation.data
    const supabase = getSupabaseAdmin()

    // Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: password || 'TempPass123!',
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé" },
          { status: 400 }
        )
      }
      throw authError
    }

    // Créer le profil dans la table users
    const { data: user, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role: role || 'user',
        plan: plan || null,
        status: status || 'active',
      })
      .select()
      .single()

    if (profileError) throw profileError

    return NextResponse.json({ user }, { status: 201 })

  } catch (error) {
    console.error("Users POST error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    )
  }
}
