"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Menu, X, ArrowRight, Heart, LibraryBig, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { createClient } from "@/lib/supabase"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuthContext } from "@/components/auth-provider"

type PlanLabel = "Découverte" | "Basic" | "Pro"

function PlanBadge({ plan }: { plan: string }) {
  const normalized = (plan || "").toLowerCase()

  // Aucun badge tant qu'aucun plan payant n'a été choisi.
  // Discovery / Basic / Pro sont les SEULS plans affichés.
  if (normalized !== "discovery" && normalized !== "basic" && normalized !== "pro") {
    return null
  }

  const label: PlanLabel =
    normalized === "pro" ? "Pro" : normalized === "basic" ? "Basic" : "Découverte"

  const isMax = label === "Pro"
  const nextPlan = label === "Découverte" ? "basic" : "pro"
  const nextLabel = label === "Découverte" ? "Basic" : "Pro"

  const palette =
    label === "Pro"
      ? "border-[#F2B33D] bg-[#F2B33D]/10 text-[#a17320]"
      : label === "Basic"
      ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]"
      : "border-[#2364d7] bg-[#2364d7]/10 text-[#2364d7]"

  const baseClass = `inline-flex min-w-[5.75rem] items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${palette}`

  if (isMax) {
    return (
      <span
        className={baseClass}
        aria-label="Votre plan actuel"
        title="Vous êtes au plan maximum"
      >
        {label}
      </span>
    )
  }

  return (
    <Link
      href={`/subscribe?plan=${nextPlan}`}
      aria-label={`Plan actuel ${label}. Passer en ${nextLabel}`}
      title={`Passer en ${nextLabel} ↑`}
      className={`${baseClass} group/badge relative cursor-pointer transition-all hover:scale-105 hover:shadow-sm`}
    >
      <span className="transition-opacity group-hover/badge:opacity-0">{label}</span>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover/badge:opacity-100">
        Passer {nextLabel}
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState("/niggaz/normalGlogo.png")

  // Tout vient du contexte central — pas de getUser() ni onAuthStateChange ici.
  const { user, userProfile, isAuthenticated, userPlan } = useAuthContext()

  const userName =
    (userProfile as any)?.full_name ||
    userProfile?.name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    ""
  const avatarUrl =
    (userProfile as any)?.avatar_url || user?.user_metadata?.avatar_url || ""

  // Charger le logo depuis site_settings (1x au mount, pas lié à l'auth)
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "logo_url")
      .single()
      .then(({ data }) => {
        if (data?.value) setLogoUrl(data.value)
      })
  }, [])

  const initials = userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F5F5F5] bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0F0F0F]/95">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <Link href="/" className="group flex items-center gap-3 transition-all duration-300 hover:opacity-80">
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#F2B33D]/10 to-[#F2B33D]/10 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
            <Image
              src={logoUrl}
              alt="Laveiye"
              width={208}
              height={44}
              className="relative dark:hidden"
              priority
            />
            <Image
              src="/niggaz/white.webp"
              alt="Laveiye"
              width={208}
              height={44}
              className="relative hidden dark:block"
              priority
            />
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {isAuthenticated && (
            <>
              <Link
                href="/library"
                className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group flex items-center gap-1.5 dark:text-white/70 dark:hover:text-white"
              >
                <LibraryBig className="h-4 w-4" aria-hidden="true" />
                Bibliothèque
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
              </Link>
              <Link
                href="/favorites"
                className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group flex items-center gap-1.5 dark:text-white/70 dark:hover:text-white"
              >
                <Heart className="h-4 w-4" />
                Favoris
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
              </Link>
              <Link
                href="/subscribe"
                className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group flex items-center gap-1.5 dark:text-white/70 dark:hover:text-white"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Abonnement
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
              </Link>
            </>
          )}
          <Link
            href="/#features"
            className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group dark:text-white/70 dark:hover:text-white"
          >
            Fonctionnalités
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
          </Link>
          <Link
            href="/pricing"
            className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group dark:text-white/70 dark:hover:text-white"
          >
            Tarifs
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
          </Link>
          {/* Lien Démo masqué en attendant la vidéo de présentation dynamique
          {!isAuthenticated && (
            <Link
              href="/dashboard"
              className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group dark:text-white/70 dark:hover:text-white"
            >
              Démo
              <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
            </Link>
          )}
          */}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <PlanBadge plan={userPlan} />
              <Link
                href="/profile"
                aria-label="Mon profil"
                className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border-2 border-[#F2B33D]/40 hover:border-[#F2B33D] transition-colors"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={userName || "avatar"} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/icons/default-avatar.svg" alt={userName || "avatar"} className="h-full w-full bg-[#F5F5F5]" />
                )}
              </Link>
              <Button asChild className="font-semibold shadow-lg shadow-[#F2B33D]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#F2B33D]/30 hover:scale-105 bg-[#F2B33D] hover:bg-[#F2B33D]/90">
                <Link href="/dashboard">
                  Mon espace
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="font-medium text-[#0F0F0F] hover:bg-[#F5F5F5]/50 dark:text-white dark:hover:bg-white/10">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button variant="outline" asChild className="font-semibold border-[#F2B33D] text-[#F2B33D] hover:bg-[#F2B33D]/10">
                <Link href="/register">Inscription</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="relative md:hidden p-2 rounded-lg transition-colors hover:bg-[#F5F5F5]/50 dark:hover:bg-white/10"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6 text-[#0F0F0F] dark:text-white" /> : <Menu className="h-6 w-6 text-[#0F0F0F] dark:text-white" />}
        </button>
      </div>

      {/* Mobile menu with animation */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="border-t border-[#F5F5F5] bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0F0F0F]/95">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {isAuthenticated && (
              <>
                <div className="px-4 py-2">
                  <PlanBadge plan={userPlan} />
                </div>
                <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 dark:text-white/70">
                  <span>Apparence</span>
                  <ThemeToggle />
                </div>
                <Link
                  href="/library"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 flex items-center gap-2 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <LibraryBig className="h-4 w-4" aria-hidden="true" />
                  Bibliothèque
                </Link>
                <Link
                  href="/favorites"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 flex items-center gap-2 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <Heart className="h-4 w-4" />
                  Favoris
                </Link>
                <Link
                  href="/subscribe"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 flex items-center gap-2 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Abonnement
                </Link>
              </>
            )}
            <Link
              href="/#features"
              className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              Fonctionnalités
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              Tarifs
            </Link>
            {!isAuthenticated && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 dark:text-white/70">
                <span>Apparence</span>
                <ThemeToggle />
              </div>
            )}
            {/* Lien Démo masqué en attendant la vidéo de présentation dynamique
            {!isAuthenticated && (
              <Link
                href="/dashboard"
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                Démo
              </Link>
            )}
            */}
            <hr className="my-3 border-[#F5F5F5] dark:border-white/10" />
            {isAuthenticated ? (
              <Button asChild className="h-12 font-semibold shadow-lg shadow-[#F2B33D]/25 bg-[#F2B33D] hover:bg-[#F2B33D]/90">
                <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                  Mon espace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-[#F2B33D] transition-all duration-300 hover:bg-[#F2B33D]/10 hover:translate-x-1"
                  onClick={() => setIsOpen(false)}
                >
                  Inscription
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
