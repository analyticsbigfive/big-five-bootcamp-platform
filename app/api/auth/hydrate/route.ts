/**
 * POST /api/auth/hydrate
 *
 * Reçoit { access_token, refresh_token } depuis le client (flux implicit
 * grant Supabase) et pose les cookies de session côté serveur. Utilisé
 * comme fallback quand setSession() côté client hang (navigator.locks
 * conflict avec onAuthStateChange).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json()
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Tokens manquants' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const cookiesToSet: { name: string; value: string; options: any }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options })
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message || 'Session invalide' },
        { status: 401 }
      )
    }

    const response = NextResponse.json({ ok: true })
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    return response
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
