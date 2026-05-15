"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js"

// Types
export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  plan: string | null
  status: string
  subscription_status: string | null
  subscription_end_date: string | null
  monthly_click_count?: number
  monthly_campaigns_explored?: number
  monthly_click_reset?: string
  [key: string]: any
}

interface AuthContextType {
  // Auth state
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  loading: boolean

  // Derived state
  isAuthenticated: boolean
  isAdmin: boolean
  isModerator: boolean
  isPremium: boolean
  isEnterprise: boolean
  userPlan: string
  isFreeUser: boolean

  // Click counters (chargés depuis /api/track-click)
  monthlyClicks: number
  monthlyExplored: number
  refreshClickCounters: () => Promise<void>

  // Actions
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string, name?: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ data: any; error: any }>
  updatePassword: (newPassword: string) => Promise<{ data: any; error: any }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthlyClicks, setMonthlyClicks] = useState(0)
  const [monthlyExplored, setMonthlyExplored] = useState(0)

  const initialCheckDone = useRef(false)
  const profileFetchedForId = useRef<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Fetch user profile from DB (une seule fois par user ID, sauf force=true)
  const fetchUserProfile = useCallback(async (authUser: User, force = false) => {
    // Éviter les doubles appels pour le même user, sauf si on force la revalidation
    // (changement de plan, retour sur l'onglet, broadcast inter-onglets…).
    if (!force && profileFetchedForId.current === authUser.id && userProfile) return

    profileFetchedForId.current = authUser.id

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()

      if (error?.code === "PGRST116") {
        // L'utilisateur n'existe pas encore en DB, le créer.
        // Plan = null : aucun abonnement actif. L'utilisateur doit souscrire à
        // Découverte / Basic / Pro pour débloquer les fonctionnalités —
        // redirect géré par use-require-active-subscription.
        const { data: newProfile, error: createError } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata?.name || authUser.email!.split("@")[0],
            role: "user",
            plan: null,
            status: "active",
            subscription_status: "none",
          })
          .select("*")
          .single()

        if (!createError && newProfile) {
          setUserProfile(newProfile as UserProfile)
        }
      } else if (!error && data) {
        // Fail-safe expiration : si subscription_end_date est dans le passé,
        // on bascule l'utilisateur en état verrouillé côté client — quel que
        // soit le plan (Discovery, Basic, Pro). Évite la fenêtre entre la
        // date de fin et l'exécution du cron.
        const hasPaidPlan = ["discovery", "basic", "pro"].includes(
          data.plan?.toLowerCase() || ""
        )
        if (
          hasPaidPlan &&
          data.subscription_end_date &&
          new Date(data.subscription_end_date) < new Date()
        ) {
          // Abonnement expiré -> repasser en état verrouillé côté client.
          // L'utilisateur sera redirigé vers /subscribe par use-require-active-subscription.
          setUserProfile({ ...data, plan: null, subscription_status: "expired" } as UserProfile)
          // Synchroniser la DB côté serveur, puis re-fetch pour refléter l'état officiel.
          fetch("/api/subscription/expire-self", { method: "POST" })
            .then(async () => {
              try {
                const { data: refreshed } = await supabase
                  .from("users")
                  .select("*")
                  .eq("id", authUser.id)
                  .single()
                if (refreshed) setUserProfile(refreshed as UserProfile)
              } catch (e) {
                console.error("AuthProvider: refetch après cron a échoué", e)
              }
            })
            .catch((err) => {
              console.error("AuthProvider: cron check-subscriptions a échoué", err)
            })
        } else {
          setUserProfile(data as UserProfile)
        }
      }
    } catch (err) {
      console.error("AuthProvider: erreur chargement profil", err)
    }
  }, [supabase, userProfile])

  // Charger les compteurs de clics
  const refreshClickCounters = useCallback(async () => {
    try {
      const res = await fetch("/api/track-click")
      if (res.ok) {
        const data = await res.json()
        setMonthlyClicks(data.clicks || 0)
        setMonthlyExplored(data.explored || 0)
      }
    } catch {
      // Silencieux
    }
  }, [])

  // Forcer le rechargement du profil (par ex. après un paiement)
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user, true)
      await refreshClickCounters()
      // Notifie les autres onglets ouverts du même browser (cross-tab sync).
      // Sans ça, un upgrade dans l'onglet B laisse l'onglet A figé sur Free.
      try {
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const ch = new BroadcastChannel("auth-profile")
          ch.postMessage({ type: "profile-changed", userId: user.id })
          ch.close()
        }
      } catch {
        /* navigateur sans BroadcastChannel : ignoré */
      }
    }
  }, [user, fetchUserProfile, refreshClickCounters])

  // Initialisation : une seule vérification auth + onAuthStateChange
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        // 1. getUser() valide le token côté serveur (fiable après refresh middleware)
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!mounted) return

        if (authUser) {
          setUser(authUser)
          // Récupérer aussi la session
          const { data: { session: authSession } } = await supabase.auth.getSession()
          if (mounted) setSession(authSession)

          await fetchUserProfile(authUser)
          await refreshClickCounters()
        }

        initialCheckDone.current = true
      } catch (err) {
        console.error("AuthProvider: erreur init", err)
        initialCheckDone.current = true
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()

    // 2. Écouter les changements d'auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        // Ignorer les events tant que l'init n'est pas finie
        if (!initialCheckDone.current) return
        if (!mounted) return

        if (event === "PASSWORD_RECOVERY") {
          // L'utilisateur a cliqué sur le lien de réinitialisation de mot de passe
          // Rediriger vers la page de changement de mot de passe
          if (newSession?.user) {
            setUser(newSession.user)
            setSession(newSession)
          }
          router.push("/update-password")
          return
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (newSession?.user) {
            setUser(newSession.user)
            setSession(newSession)

            // Ne re-fetch le profil que si c'est un nouvel user
            if (profileFetchedForId.current !== newSession.user.id) {
              await fetchUserProfile(newSession.user)
              await refreshClickCounters()
            }
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null)
          setSession(null)
          setUserProfile(null)
          setMonthlyClicks(0)
          setMonthlyExplored(0)
          profileFetchedForId.current = null
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile, refreshClickCounters])

  // Synchro inter-onglets + revalidation au retour de visibilité.
  // Corrige le cas : tab A ouverte sur Free, tab B fait l'upgrade Pro,
  // tab A doit voir Pro sans reload manuel.
  useEffect(() => {
    if (!user) return

    const revalidate = async () => {
      try {
        const { data: { user: fresh } } = await supabase.auth.getUser()
        if (!fresh) return
        await fetchUserProfile(fresh, true)
        await refreshClickCounters()
      } catch {
        /* silencieux */
      }
    }

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        revalidate()
      }
    }

    let channel: BroadcastChannel | null = null
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("auth-profile")
        channel.onmessage = (ev) => {
          if (ev.data?.type === "profile-changed" && ev.data.userId === user.id) {
            revalidate()
          }
        }
      }
    } catch {
      channel = null
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible)
      window.addEventListener("focus", onVisible)
    }

    return () => {
      if (channel) channel.close()
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible)
        window.removeEventListener("focus", onVisible)
      }
    }
  }, [user, supabase, fetchUserProfile, refreshClickCounters])

  // Actions
  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || email.split("@")[0] },
        emailRedirectTo: `${baseUrl}/auth/callback?next=/dashboard`,
      },
    })

    if (data.user && !error) {
      // Aucun plan par défaut : choix de plan PAYANT obligatoire après signup.
      await supabase.from("users").insert({
        id: data.user.id,
        email: data.user.email!,
        name: name || data.user.email!.split("@")[0],
        role: "user",
        plan: null,
        status: "active",
        subscription_status: "none",
      })
    }

    return { data, error }
  }, [supabase])

  const signOut = useCallback(async () => {
    // scope: "global" → révoque la session côté serveur et supprime les cookies
    // émet SIGNED_OUT pour tous les onglets. Évite de rester "connecté côté cookie"
    // après un signOut local, symptôme qui bloquait l'utilisateur sur /login.
    try {
      await supabase.auth.signOut({ scope: "global" })
    } catch {
      // En cas d'échec réseau, on tente quand même le nettoyage local.
      try { await supabase.auth.signOut({ scope: "local" }) } catch { /* ignore */ }
    }
    setUser(null)
    setSession(null)
    setUserProfile(null)
    setMonthlyClicks(0)
    setMonthlyExplored(0)
    profileFetchedForId.current = null
  }, [supabase])

  const resetPassword = useCallback(async (email: string) => {
    const baseUrl = window.location.origin
    // Poser un cookie pour que le callback sache qu'il s'agit d'un reset password
    // (les query params dans redirectTo peuvent être perdus lors du redirect Supabase)
    document.cookie = 'sb-password-recovery=true; path=/; max-age=3600; samesite=lax'
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/callback?type=recovery&next=/update-password`,
    })
    return { data, error }
  }, [supabase])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    return { data, error }
  }, [supabase])

  // Derived state
  const planLower = userProfile?.plan?.toLowerCase() || ""
  const isAuthenticated = !!user
  const isAdmin = userProfile?.role === "admin"
  const isModerator = userProfile?.role === "moderator" || isAdmin
  const isPremium = ["basic", "pro"].includes(planLower)
  // Legacy : agency / enterprise n'existent plus mais on garde un flag neutre pour compat
  const isEnterprise = false
  const userPlan = userProfile?.plan || ""
  const isFreeUser = !isPremium || userProfile?.subscription_status !== "active"

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    session,
    userProfile,
    loading,
    isAuthenticated,
    isAdmin,
    isModerator,
    isPremium,
    isEnterprise,
    userPlan,
    isFreeUser,
    monthlyClicks,
    monthlyExplored,
    refreshClickCounters,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  }), [
    user, session, userProfile, loading,
    isAuthenticated, isAdmin, isModerator, isPremium, isEnterprise,
    userPlan, isFreeUser,
    monthlyClicks, monthlyExplored, refreshClickCounters,
    signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile,
  ])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook pour consommer le contexte Auth.
 * Doit être utilisé dans un composant enfant de <AuthProvider>.
 */
export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuthContext doit être utilisé à l'intérieur de <AuthProvider>")
  }
  return ctx
}
