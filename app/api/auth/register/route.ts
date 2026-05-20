export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from '@supabase/supabase-js'
import { isDisposableEmail } from '@/lib/disposable-emails'

const registerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  website: z.string().optional(),
  elapsedMs: z.number().optional(),
  captchaToken: z.string().optional(),
})

// Rate limit en mémoire : max 5 tentatives par IP / 10 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const MIN_FORM_TIME_MS = 1500
const ipAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = ipAttempts.get(ip)

  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, website, elapsedMs, captchaToken } = validation.data

    // Refuser les domaines d'emails jetables / temporaires
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        {
          error:
            "Les adresses email jetables ne sont pas acceptées. Merci d'utiliser une adresse email personnelle ou professionnelle valide.",
        },
        { status: 400 }
      )
    }

    // Honeypot : champ "website" doit rester vide. Si rempli → bot.
    if (website && website.trim().length > 0) {
      return NextResponse.json({ message: "Compte créé avec succès" }, { status: 201 })
    }

    // Anti-bot temporel : un humain met au moins 1.5s à remplir le formulaire
    if (typeof elapsedMs === "number" && elapsedMs < MIN_FORM_TIME_MS) {
      return NextResponse.json({ message: "Compte créé avec succès" }, { status: 201 })
    }

    // Rate limiting par IP
    const remoteIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    const rate = checkRateLimit(remoteIp)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rate.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter ?? 60) } }
      )
    }

    // Création via supabase.auth.signUp (client anon).
    // → Supabase envoie automatiquement l'email de confirmation (si activé dans le projet).
    // → L'utilisateur n'a PAS de session tant qu'il n'a pas cliqué sur le lien.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante côté serveur" },
        { status: 500 }
      )
    }

    // URL de redirection après clic sur le lien de confirmation.
    // Priorité : NEXT_PUBLIC_APP_URL (défini en prod) > NEXT_PUBLIC_SITE_URL (legacy) > origin de la requête (dev).
    // Important : sur Vercel l'origin de la requête est le domaine de déploiement (`*.vercel.app`)
    // et pas le domaine canonique → le lien email pointerait vers un host différent et casserait la session.
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin
    const emailRedirectTo = `${siteUrl}/auth/callback?next=/dashboard`

    const supabaseAnon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo,
        captchaToken: captchaToken,
      },
    })

    if (signUpError) {
      console.error("SignUp error:", signUpError.message)
      const msg = signUpError.message.toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return NextResponse.json(
          { error: "Un compte avec cet email existe déjà" },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: signUpError.message || "Erreur lors de la création du compte" },
        { status: 500 }
      )
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: "Erreur lors de la création du compte" },
        { status: 500 }
      )
    }

    // Créer le profil dans la table users via service role (bypass RLS).
    // Aucun plan par défaut : le choix d'un plan PAYANT (Découverte / Basic / Pro)
    // est obligatoire pour accéder à la plateforme.
    const supabaseAdmin = getSupabaseAdmin()
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: signUpData.user.id,
        email,
        name,
        role: 'user',
        plan: null,
        status: 'active',
        subscription_status: 'none',
      }, { onConflict: 'id' })

    if (profileError) {
      console.error("Profile creation error:", profileError.message)
      // Non bloquant — le profil sera créé au premier login si nécessaire (auth/callback)
    }

    // Si email_confirmed_at est null, l'utilisateur doit confirmer son email.
    const needsEmailConfirmation = !signUpData.user.email_confirmed_at

    return NextResponse.json({
      message: "Compte créé avec succès",
      needsEmailConfirmation,
      user: {
        id: signUpData.user.id,
        email,
        name,
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la création du compte" },
      { status: 500 }
    )
  }
}
