"use client"

import React from "react"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, Check, Shield, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { LegalModal } from "@/components/legal-modal"

function formatNumber(n: number): string {
  if (n >= 1000) {
    return new Intl.NumberFormat("fr-FR").format(n)
  }
  return n.toString()
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || ''
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [website, setWebsite] = useState("")
  const [formStartedAt] = useState(() => Date.now())
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          website,
          elapsedMs: Date.now() - formStartedAt,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error("Erreur lors de la création du compte", {
          description: data.error || "Veuillez réessayer.",
        })
        return
      }

      if (data.needsEmailConfirmation) {
        toast.success("Compte créé ! 📧", {
          description: "Un email de confirmation a été envoyé à " + email + ". Vérifie ta boîte de réception (et les spams).",
          duration: 8000,
        })
      } else {
        toast.success("Compte créé avec succès !", {
          description: "Tu peux maintenant te connecter.",
        })
      }
      router.push(redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login")
    } catch (err) {
      toast.error("Une erreur inattendue est survenue", {
        description: "Veuillez réessayer plus tard.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const benefits = [
    "Accès à toute la bibliothèque",
    "Nouveaux contenus ajoutés quotidiennement",
    "Filtres et recherche avancés",
    "Annulation possible à tout moment"
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left side - Visual */}
      <div className="relative hidden flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-[#F2B33D]/20 via-transparent to-transparent" />
          <div className="flex h-full flex-col items-center justify-center p-12">
            <div className="max-w-md">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#F2B33D]/15 px-4 py-1.5 text-sm text-[#F2B33D] font-medium">
                <Shield className="h-4 w-4" />
                Inscription gratuite
              </div>
              
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[#0F0F0F]">
                Rejoins des milliers de créatifs africains
              </h2>
              <p className="mt-4 text-lg text-[#0F0F0F]/70">
                Découvre les meilleures campagnes marketing du continent africain.
              </p>
              
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3 text-[#0F0F0F]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981]/20">
                      <Check className="h-4 w-4 text-[#10B981]" />
                    </div>
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="mt-12 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#F5F5F5] text-xs font-medium text-[#0F0F0F]"
                    >
                      {["AB", "CD", "EF", "GH"][i - 1]}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-[#0F0F0F]/80">
                  <span className="font-semibold text-[#0F0F0F]">{stats.users > 0 ? `+${formatNumber(stats.users)}` : '...'}</span> marketeurs actifs
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex w-45 items-center justify-center ">
                <img src="/logo.png" alt="Laveiye" className="relative" />
              </div>
            </Link>
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
              Créer ton compte
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gratuit — Accède à la bibliothèque créative
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Nom complet
                </Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ton nom complet"
                    className="h-11 pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              </div>

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
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Mot de passe
                </Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 caractères"
                    className="h-11 pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
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

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground">
                  {"J'accepte les"}{" "}
                  <LegalModal
                    trigger={
                      <button type="button" className="text-primary hover:underline">
                        CGU, CGV et la politique de confidentialité
                      </button>
                    }
                  />
                </Label>
              </div>

              <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full shadow-lg shadow-primary/25"
              disabled={isLoading || !acceptTerms}
            >
              {isLoading ? "Création du compte..." : "Créer mon compte"}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Données sécurisées
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"} className="font-medium text-primary hover:text-primary/80">
              Connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
