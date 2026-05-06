"use client"

import React from "react"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"

function formatNumber(n: number): string {
  if (n >= 1000) {
    return new Intl.NumberFormat("fr-FR").format(n)
  }
  return n.toString()
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [stats, setStats] = useState({ users: 0, campaigns: 0, brands: 0, countries: 0 })

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats({ users: 0, campaigns: 0, brands: 0, countries: 0 }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Messages d'erreur spécifiques
        if (error.message === "Invalid login credentials") {
          toast.error("Compte introuvable", {
            description: "Aucun compte n'est associé à cet email ou le mot de passe est incorrect.",
          })
        } else if (error.message === "Email not confirmed") {
          toast.warning("Email non vérifié", {
            description: "Veuillez vérifier votre boîte mail pour confirmer votre compte.",
          })
        } else {
          toast.error("Erreur de connexion", {
            description: error.message,
          })
        }
        return
      }

      toast.success("Connexion réussie !", {
        description: "Redirection vers votre tableau de bord...",
      })
      
      // Forcer le rechargement complet pour que le middleware détecte la session
      window.location.href = redirectTo
    } catch (err) {
      toast.error("Une erreur inattendue est survenue", {
        description: "Veuillez réessayer plus tard.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8 animate-fade-in-up">
            <Link href="/" className="group inline-flex items-center gap-3 transition-all duration-300">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
                <img src="/logo.png" alt="Laveiye" className="relative w-50"/>
              </div>
            </Link>
          </div>

          <div className="animate-fade-in-up delay-100">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
              Content de te revoir !
            </h1>
            <p className="mt-3 text-muted-foreground">
              Connecte-toi pour accéder à ta bibliothèque
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ton@email.com"
                    className="h-11 pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Mot de passe
                  </Label>
                  <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    className="h-11 pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button type="submit" className="h-11 w-full shadow-lg shadow-primary/25" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>

          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              Inscription
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5]">
          {/* Animated background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[#F2B33D]/20 blur-3xl animate-pulse-glow" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#F2B33D]/20 blur-3xl animate-pulse-glow delay-300" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-[#0F0F0F]/10 blur-3xl animate-pulse-glow delay-500" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F2B33D]/20 via-transparent to-transparent" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

          <div className="relative flex h-full flex-col items-center justify-center p-12">
            <div className="max-w-md text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F2B33D]/10 px-4 py-1.5 text-sm font-medium text-[#F2B33D] mb-6">
                <Sparkles className="h-4 w-4 text-[#F2B33D]" />
                Plateforme créative
              </span>
              <h2 className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[#0F0F0F]">
                <span>
                  {"L'inspiration créative"}
                </span>
                <br />
                <span className="text-[#F2B33D]">
                  à portée de clic
                </span>
              </h2>
              <p className="mt-6 text-lg text-[#0F0F0F]/70">
                Des milliers de campagnes social media pour inspirer vos prochaines créations.
              </p>
              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  { gradient: "from-[#FFCC00] to-[#FF9500]" },
                  { gradient: "from-[#F2B33D] to-[#0F0F0F]" },
                  { gradient: "from-[#1DA1F2] to-[#0D8ECF]" },
                ].map((item, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl bg-white/80 border border-[#F5F5F5] shadow-lg hover-lift">
                    <div className={`h-full w-full bg-gradient-to-br ${item.gradient} opacity-80`} />
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-10 flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0F0F0F]">{stats.campaigns > 0 ? `${formatNumber(stats.campaigns)}+` : '...'}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Campagnes</div>
                </div>
                <div className="h-8 w-px bg-[#F5F5F5]" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0F0F0F]">{stats.brands > 0 ? `${formatNumber(stats.brands)}+` : '...'}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Marques</div>
                </div>
                <div className="h-8 w-px bg-[#F5F5F5]" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#0F0F0F]">{stats.countries > 0 ? `${formatNumber(stats.countries)}+` : '...'}</div>
                  <div className="text-xs text-[#0F0F0F]/60">Pays</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
