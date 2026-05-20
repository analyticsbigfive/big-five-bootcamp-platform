
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * On limite volontairement le matcher aux routes qui nécessitent
     * une vérification d'auth côté middleware. Toutes les autres routes
     * (API, pages publiques, assets, prefetch) ne déclenchent plus
     * supabase.auth.getUser() à chaque requête.
     *
     * - '/'                   : pour intercepter les erreurs OTP/lien Supabase
     *                           redirigées par défaut vers le SITE_URL.
     * - routes protégées       : /dashboard, /favorites, /profile, /subscribe, /admin
     * - routes auth (redirect) : /login, /register
     */
    '/',
    '/dashboard/:path*',
    '/favorites/:path*',
    '/profile/:path*',
    '/subscribe/:path*',
    '/admin/:path*',
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
  ],
}

