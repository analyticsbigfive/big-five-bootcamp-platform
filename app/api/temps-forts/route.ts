import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseAdmin } from "@/lib/supabase"
import { mapRowToTempsFort, mapTempsFortToRow } from "@/lib/temps-forts"

export const dynamic = "force-dynamic"

const ADMIN_EMAILS = [
  "jeanluc@bigfiveabidjan.com",
  "cossi@bigfiveabidjan.com",
  "yannick@bigfiveabidjan.com",
  "franck@bigfiveabidjan.com",
  "stephanie@bigfiveabidjan.com",
]

async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    return user.app_metadata?.role === "admin" || ADMIN_EMAILS.includes((user.email || "").toLowerCase())
  } catch {
    return false
  }
}

function slugify(text: string): string {
  if (!text) return ""
  const accentMap: Record<string, string> = {
    à: "a", â: "a", ä: "a", á: "a", ã: "a",
    è: "e", ê: "e", ë: "e", é: "e",
    ì: "i", î: "i", ï: "i", í: "i",
    ò: "o", ô: "o", ö: "o", ó: "o", õ: "o",
    ù: "u", û: "u", ü: "u", ú: "u",
    ñ: "n", ç: "c",
  }
  return text
    .toLowerCase()
    .split("")
    .map((c) => accentMap[c] || c)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as any
    const { data, error } = await supabase
      .from("temps_forts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("event_date", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message, tempsForts: [] }, { status: 500 })
    }

    // Calcul dynamique du nombre de campagnes associées (status Publié) par slug.
    const counts = new Map<string, number>()
    let countsLoaded = false
    try {
      const { data: campaignRows, error: campaignError } = await supabase
        .from("campaigns")
        .select("temps_fort_slugs, status")
        .in("status", ["Publié", "PubliÃ©"])
      if (!campaignError) countsLoaded = true
      for (const row of campaignRows || []) {
        for (const slug of row.temps_fort_slugs || []) {
          counts.set(slug, (counts.get(slug) || 0) + 1)
        }
      }
    } catch {
      // si la colonne n'existe pas encore, on garde les counts seedés
    }

    const tempsForts = (data || []).map((row: any) => {
      const tf = mapRowToTempsFort(row)
      return countsLoaded ? { ...tf, campaignCount: counts.get(tf.slug) || 0 } : tf
    })

    return NextResponse.json({ tempsForts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, tempsForts: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const supabase = getSupabaseAdmin() as any

    const slugBase = body.slug ? slugify(body.slug) : slugify(body.title || "")
    if (!slugBase) {
      return NextResponse.json({ error: "Titre ou slug requis" }, { status: 400 })
    }
    let slug = slugBase
    let counter = 2
    while (true) {
      const { data: existing } = await supabase
        .from("temps_forts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle()
      if (!existing) break
      slug = `${slugBase}-${counter}`
      counter++
    }

    const id = body.id || `tf-${slug}-${Date.now().toString(36)}`
    const row = mapTempsFortToRow({ ...body, id, slug })

    const { data, error } = await supabase.from("temps_forts").insert(row).select().single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ tempsFort: mapRowToTempsFort(data) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }
    const supabase = getSupabaseAdmin() as any

    if (rest.slug) {
      const slugBase = slugify(rest.slug)
      let slug = slugBase
      let counter = 2
      while (true) {
        const { data: existing } = await supabase
          .from("temps_forts")
          .select("id")
          .eq("slug", slug)
          .neq("id", id)
          .maybeSingle()
        if (!existing) break
        slug = `${slugBase}-${counter}`
        counter++
      }
      rest.slug = slug
    }

    const row = { ...mapTempsFortToRow(rest), updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from("temps_forts").update(row).eq("id", id).select().single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ tempsFort: mapRowToTempsFort(data) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 })
    }
    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase.from("temps_forts").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
