"use client"

/**
 * Carrousel "preview" affiché sur la page d'abonnement.
 *
 * - Récupère 4 campagnes via /api/contents?limit=4 (avec fallback statique
 *   si l'utilisateur n'est pas encore authentifié ou si l'API est indisponible).
 * - Affiche un message dynamique vendeur selon le plan sélectionné.
 * - Auto-rotation toutes les 4s, avec navigation tactile par dots.
 */

import { useEffect, useMemo, useState } from "react"
import { Sparkles, Zap, Star } from "lucide-react"
import { getGoogleDriveImageUrl } from "@/lib/utils"

type PlanChoice = "discovery" | "basic" | "pro"

type Campaign = {
  id: string
  title: string
  brand?: string | null
  thumbnail?: string | null
}

const FALLBACK_CAMPAIGNS: Campaign[] = [
  { id: "fb1", title: "Maggi — Tonton Ali", brand: "Maggi", thumbnail: "/placeholder.jpg" },
  { id: "fb2", title: "Orange — La Famille", brand: "Orange", thumbnail: "/placeholder.jpg" },
  { id: "fb3", title: "MTN — Pulse", brand: "MTN", thumbnail: "/placeholder.jpg" },
  { id: "fb4", title: "NSIA — Avenir", brand: "NSIA", thumbnail: "/placeholder.jpg" },
]

// ⚠️ Les `perks` ci-dessous DOIVENT rester strictement identiques aux `features`
// listées dans `PLANS` (app/subscribe/page.tsx) pour garantir la cohérence
// entre le pitch carrousel et les cartes plans plus bas dans la page.
const PLAN_PITCH: Record<PlanChoice, { headline: string; subline: string; perks: string[]; accent: string; icon: typeof Sparkles }> = {
  discovery: {
    headline: "Goûtez à la créativité africaine",
    subline: "Une porte d'entrée payante pour explorer Laveiye et tester sa puissance avant de passer à la vitesse supérieure.",
    perks: [
      "Accès limité à la bibliothèque",
      "10 campagnes consultables / mois",
      "5 recherches ou filtres / mois",
      "Alertes email hebdo",
    ],
    accent: "#0F0F0F",
    icon: Sparkles,
  },
  basic: {
    headline: "Inspirez-vous sans limite",
    subline: "Toute la bibliothèque, les filtres avancés et le téléchargement des visuels — pour pitcher plus vite.",
    perks: [
      "Accès illimité à toute la bibliothèque",
      "Filtres avancés (Secteur, Pays, Format...)",
      "Collections personnalisées",
      "Téléchargement des visuels",
      "30 recherches ou filtres / mois",
    ],
    accent: "#F2B33D",
    icon: Zap,
  },
  pro: {
    headline: "Passez en mode créatif Pro",
    subline: "Tout Basic + sessions expert #BigFiveDécrypte et support prioritaire. Pour les équipes qui ne ratent jamais une campagne.",
    perks: [
      "Tout du plan Basic",
      "Recherches ou filtres illimités",
      "Sessions expert #BigFiveDécrypte",
      "Support prioritaire",
    ],
    accent: "#F2B33D",
    icon: Star,
  },
}

export function SubscribeCampaignsCarousel({ plan }: { plan: PlanChoice }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(FALLBACK_CAMPAIGNS)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch("/api/contents?limit=4&page=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.contents?.length) return
        setCampaigns(
          data.contents.slice(0, 4).map((c: any) => ({
            id: String(c.id),
            title: c.title,
            brand: c.brand,
            thumbnail: c.thumbnail,
          }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (campaigns.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % campaigns.length)
    }, 4000)
    return () => clearInterval(id)
  }, [campaigns.length])

  const pitch = PLAN_PITCH[plan]
  const Icon = pitch.icon

  const current = campaigns[index] ?? FALLBACK_CAMPAIGNS[0]
  const thumb = useMemo(() => {
    const raw = current?.thumbnail || "/placeholder.jpg"
    try {
      return getGoogleDriveImageUrl(raw)
    } catch {
      return raw
    }
  }, [current])

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#F5F5F5] bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
        {/* Visuel */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0F0F0F]/5 md:aspect-auto md:h-full md:min-h-[260px]">
          {campaigns.map((c, i) => {
            const src = (() => {
              try {
                return getGoogleDriveImageUrl(c.thumbnail || "/placeholder.jpg")
              } catch {
                return c.thumbnail || "/placeholder.jpg"
              }
            })()
            return (
              <img
                key={c.id}
                src={src}
                alt={c.title}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === index ? "opacity-100" : "opacity-0"
                }`}
                loading={i === 0 ? "eager" : "lazy"}
              />
            )
          })}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              {current?.brand || "Marque"}
            </p>
            <p className="line-clamp-2 text-sm font-bold text-white">{current?.title}</p>
          </div>
          {/* Dots */}
          <div className="absolute right-3 top-3 flex gap-1.5">
            {campaigns.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller à la campagne ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-[#F2B33D]" : "w-2 bg-white/70 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Pitch dynamique */}
        <div className="flex flex-col justify-center gap-3 p-5">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-[#F2B33D]/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#a17320]">
            <Icon className="h-3.5 w-3.5" />
            Plan {plan === "discovery" ? "Découverte" : plan === "basic" ? "Basic" : "Pro"}
          </div>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-extrabold leading-tight text-[#0F0F0F]">
            {pitch.headline}
          </h3>
          <p className="text-sm text-[#0F0F0F]/70">{pitch.subline}</p>
          <ul className="mt-1 space-y-1.5">
            {pitch.perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-[#0F0F0F]/80">
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: pitch.accent }}
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M2 6.5 5 9.5 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
