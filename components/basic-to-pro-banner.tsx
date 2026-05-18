'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Sparkles, X, Zap } from "lucide-react"

type Trigger = "searches-heavy" | "filters-heavy" | "analyses-repeat" | "temps-forts"

interface BasicToProBannerProps {
  trigger: Trigger
  /** Pourcentage d'usage (0-100) — utilisé pour les triggers "searches-heavy" */
  usagePercent?: number
  /** Texte spécifique facultatif */
  customMessage?: string
  /** Identifiant utilisé pour le dismiss persistant (localStorage) */
  dismissKey?: string
  /** Variante d'affichage */
  variant?: "compact" | "full"
}

const TRIGGER_CONTENT: Record<Trigger, { title: string; body: string; cta: string }> = {
  "searches-heavy": {
    title: "Vous explorez beaucoup ce mois-ci 🚀",
    body: "Avec Pro, vous obtenez des recherches et filtres illimités, plus l'analyse stratégique complète sur chaque campagne.",
    cta: "Passer en Pro",
  },
  "filters-heavy": {
    title: "Les filtres avancés font partie de Pro",
    body: "Pays, secteur, tags, formats… débloquez tous les filtres en illimité pour cibler vos veilles plus rapidement.",
    cta: "Débloquer les filtres",
  },
  "analyses-repeat": {
    title: "Vous consultez souvent les analyses",
    body: "Pro vous offre l'analyse stratégique détaillée, le scoring d'efficacité et l'export PDF — sans aucune limite.",
    cta: "Activer Pro",
  },
  "temps-forts": {
    title: "Les Temps Forts sont une exclusivité Pro",
    body: "Accédez aux campagnes phares qui ont marqué l'année, leur stratégie décortiquée et les enseignements à retenir.",
    cta: "Découvrir Pro",
  },
}

export function BasicToProBanner({
  trigger,
  usagePercent,
  customMessage,
  dismissKey,
  variant = "full",
}: BasicToProBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!dismissKey) return
    try {
      const v = localStorage.getItem(`b2p_dismiss_${dismissKey}`)
      if (v === "1") setDismissed(true)
    } catch { /* noop */ }
  }, [dismissKey])

  const handleDismiss = () => {
    setDismissed(true)
    if (dismissKey) {
      try { localStorage.setItem(`b2p_dismiss_${dismissKey}`, "1") } catch { /* noop */ }
    }
  }

  if (dismissed) return null

  const content = TRIGGER_CONTENT[trigger]
  const body = customMessage || content.body

  if (variant === "compact") {
    return (
      <div className="relative flex items-center gap-3 rounded-xl border border-[#F2B33D]/30 bg-gradient-to-r from-[#FFFBEC] to-[#FFF6E5] dark:from-[#F2B33D]/10 dark:to-card px-4 py-3 text-sm">
        <Zap className="h-4 w-4 shrink-0 text-[#F2B33D]" />
        <span className="flex-1 text-foreground/80">
          <strong>{content.title}</strong> — {body}
        </span>
        <Link
          href="/subscribe?plan=pro"
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background hover:bg-foreground/85 transition-colors"
        >
          {content.cta}
          <ArrowRight className="h-3 w-3" />
        </Link>
        {dismissKey && (
          <button
            type="button"
            aria-label="Masquer ce message"
            title="Masquer"
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F2B33D]/30 bg-gradient-to-br from-[#FFFBEC] via-white to-[#FFF6E5] dark:from-[#F2B33D]/10 dark:via-card dark:to-card p-5 md:p-6">
      {dismissKey && (
        <button
          type="button"
          aria-label="Masquer ce message"
          title="Masquer"
          onClick={handleDismiss}
          className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F2B33D]/15">
          <Sparkles className="h-5 w-5 text-[#F2B33D]" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-foreground text-base md:text-lg">
            {content.title}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {body}
            {typeof usagePercent === "number" && trigger === "searches-heavy" && (
              <> Vous avez utilisé <strong>{Math.round(usagePercent)}%</strong> de vos recherches mensuelles Basic.</>
            )}
          </p>
        </div>
        <Link
          href="/subscribe?plan=pro"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background hover:bg-foreground/85 transition-colors"
        >
          {content.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
