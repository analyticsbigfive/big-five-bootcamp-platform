import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const SETTING_KEY = 'temps_forts_overrides'

export type TempsFortsOverrides = {
  bannerSlug: string | null
  popupSlug: string | null
  bannerEnabled: boolean
  popupEnabled: boolean
  version: number
}

const DEFAULT_OVERRIDES: TempsFortsOverrides = {
  bannerSlug: null,
  popupSlug: null,
  bannerEnabled: true,
  popupEnabled: true,
  version: 1,
}

const ADMIN_EMAILS = [
  'jeanluc@bigfiveabidjan.com',
  'cossi@bigfiveabidjan.com',
  'yannick@bigfiveabidjan.com',
  'franck@bigfiveabidjan.com',
  'stephanie@bigfiveabidjan.com',
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
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    return user.app_metadata?.role === 'admin' || ADMIN_EMAILS.includes((user.email || '').toLowerCase())
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ overrides: DEFAULT_OVERRIDES })
    }

    if (!data?.value) {
      return NextResponse.json({ overrides: DEFAULT_OVERRIDES })
    }

    try {
      const parsed = JSON.parse(data.value) as Partial<TempsFortsOverrides>
      return NextResponse.json({
        overrides: { ...DEFAULT_OVERRIDES, ...parsed },
      })
    } catch {
      return NextResponse.json({ overrides: DEFAULT_OVERRIDES })
    }
  } catch {
    return NextResponse.json({ overrides: DEFAULT_OVERRIDES })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const body = (await request.json()) as Partial<TempsFortsOverrides>
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle()

  let current: TempsFortsOverrides = DEFAULT_OVERRIDES
  if (existing?.value) {
    try {
      current = { ...DEFAULT_OVERRIDES, ...(JSON.parse(existing.value) as Partial<TempsFortsOverrides>) }
    } catch {
      current = DEFAULT_OVERRIDES
    }
  }

  const next: TempsFortsOverrides = {
    bannerSlug: body.bannerSlug !== undefined ? body.bannerSlug : current.bannerSlug,
    popupSlug: body.popupSlug !== undefined ? body.popupSlug : current.popupSlug,
    bannerEnabled: body.bannerEnabled !== undefined ? body.bannerEnabled : current.bannerEnabled,
    popupEnabled: body.popupEnabled !== undefined ? body.popupEnabled : current.popupEnabled,
    version: (current.version || 1) + 1,
  }

  const { error } = await supabase
    .from('site_settings')
    .upsert(
      {
        key: SETTING_KEY,
        value: JSON.stringify(next),
        description: 'Réglages des bannières/pop-ups Temps forts',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ overrides: next })
}
