"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Menu, X, ArrowRight, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { createClient } from "@/lib/supabase"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [logoUrl, setLogoUrl] = useState("/niggaz/normalGlogo.png")
  const initialCheckDone = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    // Charger le logo depuis site_settings
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "logo_url")
      .single()
      .then(({ data }) => {
        if (data?.value) setLogoUrl(data.value)
      })

    // Vérifier l'utilisateur via getUser() (valide le token côté serveur)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
      initialCheckDone.current = true
    })

    // Écouter les changements APRÈS l'init (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!initialCheckDone.current) return
      setIsAuthenticated(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F5F5F5] bg-white/95 backdrop-blur-xl">
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
                className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group flex items-center gap-1.5"
              >
                <Image
                  src="/icon_bibliotheque.png"
                  alt="Icône bibliothèque"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                />
                Bibliothèque
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
              </Link>
              <Link
                href="/favorites"
                className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group flex items-center gap-1.5"
              >
                <Heart className="h-4 w-4" />
                Favoris
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
              </Link>
            </>
          )}
          <Link
            href="/#features"
            className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group"
          >
            Fonctionnalités
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
          </Link>
          <Link
            href="/pricing"
            className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group"
          >
            Tarifs
            <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
          </Link>
          {/* Lien Démo masqué en attendant la vidéo de présentation dynamique
          {!isAuthenticated && (
            <Link
              href="/dashboard"
              className="relative px-4 py-2 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:text-[#0F0F0F] group"
            >
              Démo
              <span className="absolute bottom-0 left-1/2 h-0.5 w-0 bg-[#F2B33D] transition-all duration-300 group-hover:left-4 group-hover:w-[calc(100%-32px)]" />
            </Link>
          )}
          */}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Button asChild className="font-semibold shadow-lg shadow-[#F2B33D]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#F2B33D]/30 hover:scale-105 bg-[#F2B33D] hover:bg-[#F2B33D]/90">
              <Link href="/dashboard">
                Mon espace
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="font-medium text-[#0F0F0F] hover:bg-[#F5F5F5]/50">
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
          className="relative md:hidden p-2 rounded-lg transition-colors hover:bg-[#F5F5F5]/50"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6 text-[#0F0F0F]" /> : <Menu className="h-6 w-6 text-[#0F0F0F]" />}
        </button>
      </div>

      {/* Mobile menu with animation */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="border-t border-[#F5F5F5] bg-white/95 backdrop-blur-xl">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {isAuthenticated && (
              <>
                <Link
                  href="/library"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Image
                    src="/icon_bibliotheque.png"
                    alt="Icône bibliothèque"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                  Bibliothèque
                </Link>
                <Link
                  href="/favorites"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1 flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Heart className="h-4 w-4" />
                  Favoris
                </Link>
              </>
            )}
            <Link
              href="/#features"
              className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1"
              onClick={() => setIsOpen(false)}
            >
              Fonctionnalités
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1"
              onClick={() => setIsOpen(false)}
            >
              Tarifs
            </Link>
            {/* Lien Démo masqué en attendant la vidéo de présentation dynamique
            {!isAuthenticated && (
              <Link
                href="/dashboard"
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1"
                onClick={() => setIsOpen(false)}
              >
                Démo
              </Link>
            )}
            */}
            <hr className="my-3 border-[#F5F5F5]" />
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
                  className="rounded-xl px-4 py-3 text-sm font-medium text-[#0F0F0F]/70 transition-all duration-300 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] hover:translate-x-1"
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
