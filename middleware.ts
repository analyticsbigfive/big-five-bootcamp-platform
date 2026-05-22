import { NextResponse, type NextRequest } from 'next/server'
import { MAINTENANCE_MODE_KEY, parseMaintenanceMode } from '@/lib/maintenance-mode'
import { updateSession } from '@/utils/supabase/proxy'

const MAINTENANCE_CACHE_TTL_MS = 15_000

let maintenanceCache: { enabled: boolean; expiresAt: number } | null = null

function shouldRunAuthMiddleware(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/subscribe') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  )
}

function isMaintenanceBypassPath(pathname: string) {
  return (
    pathname === '/maintenance' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin')
  )
}

async function isMaintenanceModeEnabled() {
  const envOverride = process.env.MAINTENANCE_MODE
  if (typeof envOverride === 'string' && envOverride.trim()) {
    return parseMaintenanceMode(envOverride)
  }

  const now = Date.now()
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.enabled
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    maintenanceCache = { enabled: false, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
    return false
  }

  try {
    const endpoint = new URL('/rest/v1/site_settings', supabaseUrl)
    endpoint.searchParams.set('select', 'value')
    endpoint.searchParams.set('key', `eq.${MAINTENANCE_MODE_KEY}`)

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      maintenanceCache = { enabled: false, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
      return false
    }

    const rows = (await response.json()) as Array<{ value?: string }>
    const enabled = parseMaintenanceMode(rows[0]?.value)
    maintenanceCache = { enabled, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
    return enabled
  } catch {
    maintenanceCache = { enabled: false, expiresAt: now + MAINTENANCE_CACHE_TTL_MS }
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (!isMaintenanceBypassPath(pathname) && (await isMaintenanceModeEnabled())) {
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (shouldRunAuthMiddleware(pathname)) {
    return await updateSession(request)
  }

  return NextResponse.next({
    request: { headers: request.headers },
  })
}

export const config = {
  matcher: [
    /*
     * Le matcher couvre les pages pour pouvoir afficher la maintenance partout,
     * en excluant les API et les assets. L'auth Supabase reste limitée dans le
     * code aux routes qui en ont besoin.
     *
     * - /maintenance : page publique visible pendant la maintenance.
     * - /admin       : toujours accessible pour désactiver le mode.
     */
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|map|txt|xml|json|woff|woff2|ttf|otf)$).*)',
  ],
}

