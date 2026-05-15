"use client"

/**
 * Nag screen pour les nouveaux utilisateurs Free.
 *
 * S'affiche une seule fois par utilisateur, lorsque :
 *   - l'utilisateur est connecté ;
 *   - son profil est chargé ;
 *   - plan === 'Free' ET subscription_status !== 'active' (vrai Free, pas Découverte) ;
 *   - le flag localStorage `nag-upgrade-shown:<userId>` n'est pas encore posé.
 *
 * Une fois fermé, le flag est posé et le nag ne réapparaît plus.
 * Le bouton "Plus tard" pose aussi le flag.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { X, Crown, Sparkles, Zap, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthContext } from "@/components/auth-provider"

const STORAGE_PREFIX = "nag-upgrade-shown:"

export function NewUserUpgradeNag() {
  const { user, userProfile, loading } = useAuthContext()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading || !user || !userProfile) return

    const plan = String((userProfile as any).plan || "").toLowerCase()
    const status = String((userProfile as any).subscription_status || "").toLowerCase()

    // Vrai Free uniquement (pas Découverte ni Basic/Pro actif).
    const isGenuineFree = plan === "free" && status !== "active"
    if (!isGenuineFree) return

    const key = `${STORAGE_PREFIX}${user.id}`
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(key)) return

    setOpen(true)
  }, [loading, user, userProfile])

  const dismiss = () => {
    if (typeof window !== "undefined" && user?.id) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, "1")
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nag-upgrade-title"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6 sm:p-8 z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#0F0F0F]/40 hover:bg-[#F5F5F5]/50 hover:text-[#0F0F0F] transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-[#F2B33D]/15 px-3 py-1 text-xs font-semibold text-[#a17320]">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Bienvenue sur Laveiye
          </div>
          <h2
            id="nag-upgrade-title"
            className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold text-[#0F0F0F]"
          >
            Choisissez le plan qui vous correspond
          </h2>
          <p className="mt-2 text-sm text-[#0F0F0F]/60 max-w-md mx-auto">
            Le compte gratuit donne un aperçu très limité. Passez à un plan
            payant pour explorer la bibliothèque créative complète.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* Découverte */}
          <Link
            href="/subscribe?plan=discovery"
            onClick={dismiss}
            className="group rounded-2xl border-2 border-[#F5F5F5] bg-white p-4 hover:border-[#2364d7]/50 hover:shadow-md transition-all"
          >
            <p className="text-xs font-semibold text-[#2364d7] mb-1">Découverte</p>
            <p className="text-2xl font-extrabold text-[#0F0F0F]">1 000</p>
            <p className="text-xs text-[#0F0F0F]/50 mb-3">FCFA/mois</p>
            <ul className="space-y-1.5 text-xs text-[#0F0F0F]/70">
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#2364d7] mt-0.5 shrink-0" />
                10 campagnes/mois
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#2364d7] mt-0.5 shrink-0" />
                5 recherches/mois
              </li>
            </ul>
          </Link>

          {/* Basic — recommandé */}
          <Link
            href="/subscribe?plan=basic"
            onClick={dismiss}
            className="group relative rounded-2xl border-2 border-[#10B981] bg-gradient-to-br from-[#10B981]/5 to-white p-4 hover:shadow-lg transition-all"
          >
            <span className="absolute -top-2.5 right-3 inline-flex items-center rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] font-bold text-white shadow">
              Recommandé
            </span>
            <p className="text-xs font-semibold text-[#10B981] mb-1">Basic</p>
            <p className="text-2xl font-extrabold text-[#0F0F0F]">4 900</p>
            <p className="text-xs text-[#0F0F0F]/50 mb-3">FCFA/mois</p>
            <ul className="space-y-1.5 text-xs text-[#0F0F0F]/70">
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10B981] mt-0.5 shrink-0" />
                Campagnes illimitées
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10B981] mt-0.5 shrink-0" />
                30 recherches/mois
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10B981] mt-0.5 shrink-0" />
                Filtres avancés
              </li>
            </ul>
          </Link>

          {/* Pro */}
          <Link
            href="/subscribe?plan=pro"
            onClick={dismiss}
            className="group rounded-2xl border-2 border-[#F2B33D]/40 bg-gradient-to-br from-[#FFFBEC] to-white p-4 hover:shadow-lg hover:border-[#F2B33D] transition-all"
          >
            <p className="text-xs font-semibold text-[#a17320] mb-1 inline-flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Pro
            </p>
            <p className="text-2xl font-extrabold text-[#0F0F0F]">9 900</p>
            <p className="text-xs text-[#0F0F0F]/50 mb-3">FCFA/mois</p>
            <ul className="space-y-1.5 text-xs text-[#0F0F0F]/70">
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#F2B33D] mt-0.5 shrink-0" />
                Tout illimité
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#F2B33D] mt-0.5 shrink-0" />
                #BigFiveDécrypte
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#F2B33D] mt-0.5 shrink-0" />
                Support prioritaire
              </li>
            </ul>
          </Link>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 border-t border-[#F5F5F5]">
          <Button
            asChild
            className="w-full sm:w-auto sm:flex-1 h-11 text-sm font-bold bg-[#F2B33D] hover:bg-[#d99a2a] text-white"
          >
            <Link href="/subscribe?plan=basic" onClick={dismiss}>
              <Zap className="mr-2 h-4 w-4" />
              Commencer avec Basic
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto h-11 text-sm font-semibold"
            onClick={dismiss}
          >
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  )
}
