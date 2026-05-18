import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Stocker le singleton sur globalThis pour survivre au HMR (Hot Module Replacement)
// En dev, le module est réévalué lors du HMR, ce qui recrée un GoTrueClient
// et provoque un conflit de navigator.locks → AbortError
const globalForSupabase = globalThis as typeof globalThis & {
  __supabaseBrowserClient?: ReturnType<typeof createBrowserClient>
}

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During static prerendering env vars may not be available — return a no-op proxy
  if (!url || !key) {
    return new Proxy({} as ReturnType<typeof createBrowserClient>, {
      get(_target, prop) {
        if (prop === 'auth') {
          return {
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: () => Promise.resolve({ error: null }),
          }
        }
        return () => Promise.resolve({ data: null, error: null })
      },
    })
  }

  // Éviter la création côté serveur
  if (typeof window === 'undefined') {
    return createBrowserClient(url, key)
  }

  if (globalForSupabase.__supabaseBrowserClient) return globalForSupabase.__supabaseBrowserClient

  // Lock custom : avale les AbortError ("signal is aborted without reason")
  // émis par navigator.locks lors d'un unmount/navigation rapide ou d'une
  // synchronisation multi-onglet. Ces erreurs sont bénignes mais polluent la
  // console. Voir https://github.com/supabase/auth-js/issues/715
  const safeNavigatorLock = async <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
  ): Promise<R> => {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) {
      return fn()
    }
    try {
      return await navigator.locks.request(
        name,
        acquireTimeout === 0 ? { mode: 'exclusive', ifAvailable: true } : { mode: 'exclusive' },
        async () => fn()
      ) as R
    } catch (err: any) {
      // AbortError silencieux — le lock a été annulé (navigation, unmount, etc.)
      if (err?.name === 'AbortError') {
        return fn()
      }
      throw err
    }
  }

  globalForSupabase.__supabaseBrowserClient = createBrowserClient(url, key, {
    auth: {
      lock: safeNavigatorLock as any,
    },
  })
  return globalForSupabase.__supabaseBrowserClient
}

// Client Supabase admin (avec la service role key pour les opérations côté serveur)
// Note: Ne pas utiliser côté client, seulement dans les API routes
// Créé paresseusement pour éviter les instances multiples
let adminClient: ReturnType<typeof createSupabaseClient> | null = null

export const getSupabaseAdmin = () => {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    // Aucun fallback ANON : ces routes ont besoin des privilèges service_role.
    // Tomber sur la clé anon ferait échouer silencieusement les writes admin
    // (RLS) et masquerait l'erreur de config en prod.
    throw new Error(
      'Supabase admin client unavailable: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.'
    )
  }

  adminClient = createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return adminClient
}

// Pour la compatibilité avec le code existant côté serveur (API routes)
// Utilise un getter paresseux pour éviter la création d'instances au chargement du module
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})

// Alias pour compatibilité - uniquement pour les API routes côté serveur
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    if (typeof window !== 'undefined') {
      return (createClient() as any)[prop]
    }
    return (getSupabaseAdmin() as any)[prop]
  },
})
