
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    // Supabase redirige les erreurs d'auth (OTP expiré, lien invalide)
    // vers le SITE_URL avec ?error=...&error_code=...&error_description=...
    // On intercepte ici pour rediriger vers la page d'erreur dédiée
    const error = request.nextUrl.searchParams.get('error')
    const errorCode = request.nextUrl.searchParams.get('error_code')
    const errorDescription = request.nextUrl.searchParams.get('error_description')

    if (request.nextUrl.pathname === '/' && error && (errorCode || errorDescription)) {
        const errorUrl = request.nextUrl.clone()
        errorUrl.pathname = '/auth/auth-code-error'
        errorUrl.search = ''
        if (error) errorUrl.searchParams.set('error', error)
        if (errorCode) errorUrl.searchParams.set('error_code', errorCode)
        if (errorDescription) errorUrl.searchParams.set('error_description', errorDescription)
        return NextResponse.redirect(errorUrl)
    }

    // Sur la home sans erreur Supabase, pas besoin de valider la session
    // côté middleware → on évite un appel getUser() à chaque navigation.
    if (request.nextUrl.pathname === '/') {
        return NextResponse.next({
            request: { headers: request.headers },
        })
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Routes accessibles aux visiteurs anonymes même sous /dashboard.
    // Permet de remplir une demande de veille concurrentielle (ou de souscrire)
    // sans compte ; la page elle-même demande l'authentification uniquement
    // au moment de la validation finale (cf. app/dashboard/brand-requests/page.tsx
    // — gate `authPromptOpen` + brouillon en sessionStorage).
    const PUBLIC_DASHBOARD_PATHS = [
        '/dashboard/brand-requests',
    ]
    const isPublicDashboardPath = PUBLIC_DASHBOARD_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    )

    // Protected routes - require authentication
    if ((pathname.startsWith('/dashboard') && !isPublicDashboardPath) ||
        pathname.startsWith('/favorites') ||
        pathname.startsWith('/profile') ||
        pathname.startsWith('/subscribe')) {

        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('redirect', pathname)
            return NextResponse.redirect(url)
        }
    }

    // Admin routes - redirect to admin login
    if (pathname.startsWith('/admin') &&
        !pathname.startsWith('/admin/login')) {

        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/admin/login'
            return NextResponse.redirect(url)
        }
    }

    // Auth routes (redirect if already logged in)
    if (pathname.startsWith('/login') ||
        pathname.startsWith('/register')) {

        if (user) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return response
}

