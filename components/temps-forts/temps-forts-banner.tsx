"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getMomentTempsForts,
  getTempsFortBySlug,
  isTempsFortActivated,
} from "@/lib/temps-forts"
import type { TempsFort } from "@/types/temps-fort"
import { useTempsFortsOverrides } from "./use-temps-forts-overrides"
import { useTempsForts } from "./use-temps-forts"

const DISMISSED_KEY = "laveiye:temps-forts-banner-dismissed"
const ROTATE_INTERVAL_MS = 6000

interface TempsFortsBannerProps {
  tempsFort?: TempsFort | null
  className?: string
}

export function TempsFortsBanner({ tempsFort, className }: TempsFortsBannerProps) {
  const overrides = useTempsFortsOverrides()
  const { tempsForts } = useTempsForts()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Liste des temps forts à afficher dans le carousel.
  const slides = useMemo<TempsFort[]>(() => {
    if (tempsFort) return [tempsFort]
    if (!overrides) return []
    if (!overrides.bannerEnabled) return []
    if (overrides.bannerSlug) {
      const found = getTempsFortBySlug(tempsForts, overrides.bannerSlug)
      return found && isTempsFortActivated(found) ? [found] : []
    }
    // Tous les temps forts actifs aujourd'hui — featured d'abord.
    const actives = getMomentTempsForts(tempsForts)
    return actives.slice().sort((a, b) => {
      if (!!a.featured === !!b.featured) return 0
      return a.featured ? -1 : 1
    })
  }, [tempsFort, overrides, tempsForts])

  const version = overrides?.version ?? 1

  // Reset / dismissal versionné (un seul état pour la bannière entière).
  useEffect(() => {
    if (slides.length === 0) {
      setMounted(false)
      setDismissed(false)
      return
    }
    setMounted(true)
    const stored = sessionStorage.getItem(DISMISSED_KEY)
    setDismissed(stored === `v${version}`)
  }, [slides.length, version])

  // Garder l'index dans les bornes si la liste change.
  useEffect(() => {
    if (index >= slides.length) setIndex(0)
  }, [slides.length, index])

  // Rotation automatique.
  useEffect(() => {
    if (!mounted || dismissed || paused || slides.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, ROTATE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [mounted, dismissed, paused, slides.length])

  if (!mounted || dismissed || slides.length === 0) return null

  const current = slides[index] || slides[0]

  const closeBanner = () => {
    sessionStorage.setItem(DISMISSED_KEY, `v${version}`)
    setDismissed(true)
  }

  const goPrev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)
  const goNext = () => setIndex((i) => (i + 1) % slides.length)

  const hasMultiple = slides.length > 1

  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-2xl border border-[#F2B33D]/30 bg-[#F2B33D]/15 shadow-sm"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="absolute inset-y-0 right-0 hidden w-1/2 md:block">
            <Image
              key={current.id}
              src={current.heroImageUrl || current.imageUrl}
              alt=""
              fill
              sizes="50vw"
              className="object-cover transition-opacity duration-500"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#FFF4D6] via-[#FFF4D6]/50 to-transparent dark:from-card dark:via-card/50" />
          </div>

          <div
            key={current.id}
            className="relative flex min-h-56 flex-col justify-center gap-5 px-6 py-7 transition-opacity duration-500 sm:px-8 md:max-w-[62%]"
          >
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-card-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#F2B33D]" />
              Temps fort
              {hasMultiple && (
                <span className="ml-1 text-muted-foreground">
                  {index + 1} / {slides.length}
                </span>
              )}
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
                {current.title}
              </h2>
              <p className="mt-2 max-w-2xl text-base font-medium leading-relaxed text-foreground/75">
                {current.description}
              </p>
            </div>

            <Button asChild className="h-11 w-fit rounded-lg bg-[#0F0F0F] px-5 font-bold text-white hover:bg-[#0F0F0F]/90">
              <Link href={`/temps-forts/${current.slug}`}>
                {current.ctaLabel || "Explorer"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Temps fort précédent"
                className="absolute left-3 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-card-foreground shadow-sm transition hover:bg-card sm:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Temps fort suivant"
                className="absolute right-16 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-card-foreground shadow-sm transition hover:bg-card sm:flex"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="absolute bottom-3 left-6 flex items-center gap-1.5 sm:left-8">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Aller au temps fort ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-6 bg-foreground" : "w-2 bg-foreground/30 hover:bg-foreground/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={closeBanner}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card text-card-foreground shadow-sm transition hover:bg-muted"
            aria-label="Fermer la bannière temps fort"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
