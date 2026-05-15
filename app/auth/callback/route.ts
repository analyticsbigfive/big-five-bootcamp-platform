
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const rawType = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'
    const cookieStore = await cookies()

    // Détecter le flux de récupération de mot de passe via le cookie
    // (fallback car les query params peuvent être perdus lors du redirect Supabase).
    // IMPORTANT : un `type` explicite (signup, email, invite...) prime sur le cookie,
    // sinon un email de vérification arrivé après un reset password est mal routé.
    const hasRecoveryCookie = cookieStore.get('sb-password-recovery')?.value === 'true'
    const isExplicitNonRecovery = rawType === 'signup' || rawType === 'email' || rawType === 'invite' || rawType === 'email_change'
    const isRecoveryFlow =
        rawType === 'recovery' ||
        next.includes('update-password') ||
        (hasRecoveryCookie && !isExplicitNonRecovery)

    // Collecter les cookies à écrire sur la réponse de redirection
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

    // ---------- 1) PKCE code flow (OAuth / magic link / etc.) ----------
    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data.session) {
            await ensureUserProfile(data.session.user)
            return buildRedirect(origin, next, isRecoveryFlow, cookiesToSet, hasRecoveryCookie)
        }
        console.error('Auth callback (code) error:', error)
    }

    // ---------- 2) Email OTP flow (signup, recovery, invite, email_change) ----------
    if (token_hash && rawType) {
        const otpType = rawType as EmailOtpType
        const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: otpType })
        if (!error && data.session) {
            await ensureUserProfile(data.session.user)
            const isSignupFlow = !isRecoveryFlow && (otpType === 'signup' || otpType === 'email')
            const targetNext = isSignupFlow ? '/auth/verified' : next
            return buildRedirect(origin, targetNext, isRecoveryFlow, cookiesToSet, hasRecoveryCookie)
        }
        console.error('Auth callback (token_hash) error:', error)
    }

    // ---------- 3) Pas de code mais cookie de récupération = flux implicite (hash fragment) ----------
    if (!code && !token_hash && isRecoveryFlow) {
        const response = NextResponse.redirect(`${origin}/update-password`)
        response.cookies.set('sb-password-recovery', '', { maxAge: 0, path: '/' })
        return response
    }

    // ---------- 4) Erreur : rediriger vers la page d'erreur ----------
    const errorUrl = new URL(`${origin}/auth/auth-code-error`)
    if (!code && !token_hash) {
        errorUrl.searchParams.set('reason', 'missing_code')
    } else {
        errorUrl.searchParams.set('reason', 'exchange_failed')
    }
    const error_description = searchParams.get('error_description')
    if (error_description) {
        errorUrl.searchParams.set('error_description', error_description)
    }
    return NextResponse.redirect(errorUrl)
}

async function ensureUserProfile(user: { id: string; email?: string | null; user_metadata?: { name?: string | null } | null } | null) {
    if (!user || !user.email) return
    try {
        const admin = getSupabaseAdmin()
        const { data: existing } = await admin
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

        if (!existing) {
            // Nouveau compte : aucun plan par defaut. L'utilisateur doit souscrire a
            // Decouverte / Basic / Pro avant d'acceder a la plateforme.
            await admin.from('users').upsert({
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.email.split('@')[0],
                role: 'user',
                plan: null,
                status: 'active',
                subscription_status: 'none',
            }, { onConflict: 'id' })
        }
    } catch (e) {
        console.error('Auto-profile creation error:', e)
    }
}

function buildRedirect(
    origin: string,
    next: string,
    isRecoveryFlow: boolean,
    cookiesToSet: { name: string; value: string; options: any }[],
    hasRecoveryCookie: boolean
) {
    const redirectUrl = isRecoveryFlow ? `${origin}/update-password` : `${origin}${next}`
    const response = NextResponse.redirect(redirectUrl)
    cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
    })
    if (hasRecoveryCookie) {
        response.cookies.set('sb-password-recovery', '', { maxAge: 0, path: '/' })
    }
    return response
}
