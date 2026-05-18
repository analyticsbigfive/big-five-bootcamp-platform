"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Check, X, Minus, Search, ArrowRight, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import content from "@/lib/homepage-content.json"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const pricingContent = content.pricing

const VEILLE_SLIDES = [
    { src: "/veilleconcurrentielle/screen_1.jpg", alt: "Aperçu rapport de veille concurrentielle — 1" },
    { src: "/veilleconcurrentielle/screen_2.jpeg", alt: "Aperçu rapport de veille concurrentielle — 2" },
] as const

const plans = pricingContent.plans.map((plan) => ({
    ...plan,
    ctaVariant: plan.ctaVariant as "outline" | "default",
}))

const comparisonFeatures = pricingContent.comparison.features as Array<{
    name: string
    discovery: string | boolean
    basic: string | boolean
    pro: string | boolean
}>

function formatPrice(price: number): string {
    return new Intl.NumberFormat("fr-FR").format(price)
}

export default function PricingPage() {
    const [isAnnual, setIsAnnual] = useState(false)
    const [veilleSlide, setVeilleSlide] = useState(0)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    // Rotation auto du carousel veille (toutes les 5s) — pause si lightbox ouvert
    useEffect(() => {
        if (lightboxOpen) return
        const id = setInterval(() => {
            setVeilleSlide((s) => (s + 1) % VEILLE_SLIDES.length)
        }, 5000)
        return () => clearInterval(id)
    }, [lightboxOpen])

    // Navigation clavier dans lightbox
    useEffect(() => {
        if (!lightboxOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") setLightboxIndex((i) => (i + 1) % VEILLE_SLIDES.length)
            else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i - 1 + VEILLE_SLIDES.length) % VEILLE_SLIDES.length)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [lightboxOpen])

    const openLightbox = (i: number) => {
        setLightboxIndex(i)
        setLightboxOpen(true)
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1">
                {/* Hero */}
                <section className="relative py-16 lg:py-28 overflow-hidden bg-background">
                    <div className="container relative mx-auto px-4 flex flex-col items-center">
                        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight mb-4 sm:mb-6 text-foreground">
                            {pricingContent.hero.title} <br className="hidden sm:block" /> <span className="text-[#F2B33D]">{pricingContent.hero.titleHighlight}</span>
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-center">
                            {pricingContent.hero.subtitle}
                        </p>

                        {/* Toggle Mensuel / Annuel */}
                        <div className="flex items-center justify-center gap-3">
                            <span className={cn(
                                "text-sm font-semibold transition-colors",
                                !isAnnual ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {pricingContent.toggle.monthly}
                            </span>
                            {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
                            <button
                                type="button"
                                onClick={() => setIsAnnual(!isAnnual)}
                                className={cn(
                                    "relative inline-flex h-7 w-[52px] items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#F2B33D]/50 focus:ring-offset-2",
                                    isAnnual ? "bg-[#F2B33D]" : "bg-muted"
                                )}
                                role="switch"
                                aria-checked={isAnnual ? "true" : "false"}
                                aria-label={pricingContent.toggle.ariaLabel}
                            >
                                <span
                                    className={cn(
                                        "inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-300",
                                        isAnnual ? "translate-x-[28px]" : "translate-x-1"
                                    )}
                                />
                            </button>
                            <span className={cn(
                                "text-sm font-semibold transition-colors",
                                isAnnual ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {pricingContent.toggle.annual}
                            </span>
                            {isAnnual && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-[#10B981]/10 px-3 py-1 text-xs font-bold text-[#10B981] ring-1 ring-[#10B981]/20">
                                    {pricingContent.toggle.annualBadge}
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Grille tarifaire responsive */}
                <section className="py-12 sm:py-20 -mt-12 sm:-mt-20 relative z-10">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center items-stretch gap-4 sm:gap-6 max-w-5xl mx-auto">
                            {plans.map((plan) => (
                                <div
                                    key={plan.key}
                                    className={cn(
                                        "relative rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]",
                                        "bg-card border border-border",
                                        plan.highlighted && "shadow-xl lg:-translate-y-4"
                                    )}
                                >
                                    {plan.badge && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#C89B4A] text-white px-5 py-1.5 rounded-full text-sm font-semibold shadow-md whitespace-nowrap">
                                            {plan.badge}
                                        </div>
                                    )}
                                    <div className={cn("mb-4 sm:mb-6", plan.badge && "mt-2")}>
                                        <h3 className="font-bold text-xxl mb-1 sm:mb-2 text-card-foreground">
                                            {plan.name}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">{plan.description}</p>
                                    </div>
                                    <div className="mb-2">
                                        {plan.monthlyPrice === -1 ? (
                                            <span className="text-2xl sm:text-3xl font-bold text-[#0F0F0F]">{pricingContent.priceLabels.custom}</span>
                                        ) : (
                                            <>
                                                <span className={cn(
                                                    "font-bold text-card-foreground",
                                                    plan.highlighted ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
                                                )}>
                                                    {isAnnual
                                                        ? formatPrice(Math.round(plan.annualPrice / 12))
                                                        : formatPrice(plan.monthlyPrice)
                                                    }
                                                </span>
                                                <span className="text-muted-foreground ml-1 text-sm">{pricingContent.priceLabels.perMonth}</span>
                                            </>
                                        )}
                                    </div>
                                    {plan.monthlyPrice > 0 && (
                                        <p className="text-xs text-muted-foreground mb-4 sm:mb-6">
                                            {isAnnual
                                                ? pricingContent.priceLabels.annualBillingTemplate.replace("{amount}", formatPrice(plan.annualPrice))
                                                : pricingContent.priceLabels.annualPerYearTemplate.replace("{amount}", formatPrice(plan.annualPrice))
                                            }
                                        </p>
                                    )}
                                    {plan.monthlyPrice <= 0 && <div className="mb-4 sm:mb-6" />}
                                    <br/>
                                    <Button
                                        asChild
                                        variant={plan.ctaVariant}
                                        className={cn(
                                            "w-full mb-6 sm:mb-8 font-semibold rounded-xl",
                                            plan.highlighted
                                                ? "h-12 text-base font-bold bg-[#C89B4A] hover:bg-[#b8862f] text-white shadow-md"
                                                : plan.ctaVariant === "default"
                                                    ? "h-12 bg-[#0F0F0F] hover:bg-[#0F0F0F]/90 text-white"
                                                    : "h-12 bg-background border border-border text-primary hover:bg-muted"
                                        )}
                                    >
                                        {plan.ctaLink.startsWith("mailto:") ? (
                                            <a href={plan.ctaLink}>{plan.cta}</a>
                                        ) : (
                                            <Link href={isAnnual && plan.monthlyPrice > 0 ? `${plan.ctaLink}&billing=annual` : plan.ctaLink}>
                                                {plan.cta}
                                            </Link>
                                        )}
                                    </Button>
                                    <ul className="space-y-3 text-sm flex-1">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className={cn("flex items-start gap-2 text-card-foreground/80", plan.boldFeatures?.includes(feature) && "font-bold text-card-foreground")}>
                                                <Check className="h-4 w-4 text-[#C89B4A] shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                        {plan.excluded.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2 text-muted-foreground">
                                                <X className="h-4 w-4 text-[#E11D48] shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Bloc Veille concurrentielle / Devis */}
                <section className="py-12 sm:py-20">
                    <div className="container mx-auto px-4">
                        <div className="max-w-5xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-[#0F0F0F] to-[#1F1F1F] text-white shadow-xl">
                            <div className="grid md:grid-cols-2 gap-0">
                                <div className="p-8 sm:p-12 flex flex-col justify-center">
                                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F2B33D]/15 px-3 py-1 text-xs font-semibold text-[#F2B33D] mb-4">
                                        <Search className="h-3.5 w-3.5" />
                                        Service sur-mesure
                                    </div>
                                    <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                                        Veille concurrentielle <span className="text-[#F2B33D]">personnalisée</span>
                                    </h2>
                                    <p className="text-white/70 text-sm sm:text-base mb-6">
                                        Recevez une veille créative dédiée à votre marque et à vos concurrents : monitoring continu, alertes ciblées, rapports périodiques. Tarification adaptée à votre périmètre.
                                    </p>
                                    <ul className="space-y-2.5 mb-8 text-sm">
                                        <li className="flex items-center gap-2.5">
                                            <Check className="h-4 w-4 text-[#F2B33D] shrink-0" />
                                            <span className="text-white/80">Brief personnalisé : marques, secteurs, pays</span>
                                        </li>
                                        <li className="flex items-center gap-2.5">
                                            <Check className="h-4 w-4 text-[#F2B33D] shrink-0" />
                                            <span className="text-white/80">Rapports créatifs réguliers</span>
                                        </li>
                                        <li className="flex items-center gap-2.5">
                                            <Check className="h-4 w-4 text-[#F2B33D] shrink-0" />
                                            <span className="text-white/80">Alertes proactives sur nouveautés</span>
                                        </li>
                                    </ul>
                                    <Button
                                        asChild
                                        className="h-12 w-fit bg-[#F2B33D] hover:bg-[#e0a330] text-[#0F0F0F] font-bold rounded-xl shadow-md group"
                                    >
                                        <Link href="/dashboard/brand-requests?new=1">
                                            Demander un devis
                                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </Button>
                                </div>
                                <div className="relative hidden md:flex items-center justify-center bg-gradient-to-br from-[#F2B33D]/20 to-transparent p-8">
                                    <button
                                        type="button"
                                        onClick={() => openLightbox(veilleSlide)}
                                        aria-label="Agrandir le visuel de veille"
                                        className="group relative w-full max-w-sm aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 backdrop-blur border border-white/10 shadow-2xl cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#F2B33D]"
                                    >
                                        {VEILLE_SLIDES.map((slide, i) => (
                                            <Image
                                                key={slide.src}
                                                src={slide.src}
                                                alt={slide.alt}
                                                fill
                                                sizes="(min-width: 768px) 24rem, 100vw"
                                                className={cn(
                                                    "object-cover transition-opacity duration-700",
                                                    i === veilleSlide ? "opacity-100" : "opacity-0"
                                                )}
                                                priority={i === 0}
                                            />
                                        ))}
                                        {/* Indicateur "cliquer pour agrandir" */}
                                        <span className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition-opacity group-hover:bg-[#F2B33D] group-hover:text-[#0F0F0F]">
                                            <ZoomIn className="h-3.5 w-3.5" />
                                            Cliquer pour agrandir
                                        </span>
                                        {/* Dots de navigation */}
                                        <span
                                            role="presentation"
                                            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur"
                                        >
                                            {VEILLE_SLIDES.map((_, i) => (
                                                <span
                                                    key={i}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setVeilleSlide(i)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            setVeilleSlide(i)
                                                        }
                                                    }}
                                                    aria-label={`Voir le visuel ${i + 1}`}
                                                    className={cn(
                                                        "h-1.5 rounded-full transition-all cursor-pointer",
                                                        i === veilleSlide ? "w-6 bg-[#F2B33D]" : "w-1.5 bg-white/50 hover:bg-white/80"
                                                    )}
                                                />
                                            ))}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tableau comparatif */}
                <section className="py-12 sm:py-20 bg-muted/20">
                    <div className="container mx-auto px-4 flex flex-col items-center">
                        <div className="flex flex-col items-center mb-8 sm:mb-12">
                            <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 text-center">
                                {pricingContent.comparison.title}
                            </h2>
                            <p className="text-muted-foreground text-sm sm:text-base max-w-xl text-center">
                                {pricingContent.comparison.subtitle}
                            </p>
                        </div>

                        {/* Desktop */}
                        <div className="hidden md:block max-w-5xl mx-auto">
                            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left p-4 sm:p-6 text-sm font-semibold text-muted-foreground w-2/5">{pricingContent.comparison.tableHeader}</th>
                                            <th className="p-4 sm:p-6 text-center text-sm font-bold text-card-foreground">Découverte</th>
                                            <th className="p-4 sm:p-6 text-center text-sm font-bold text-card-foreground">Basic</th>
                                            <th className="p-4 sm:p-6 text-center text-sm font-bold text-[#F2B33D] bg-[#F2B33D]/5">Pro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonFeatures.map((feature, idx) => (
                                                <tr key={feature.name} className={cn("border-b border-border/50", idx % 2 === 0 ? "bg-card" : "bg-muted/10")}>
                                                    <td className="p-4 sm:p-5 text-sm text-card-foreground/80 font-medium">{feature.name}</td>
                                                {(["discovery", "basic", "pro"] as const).map((planKey) => {
                                                    const value = feature[planKey]
                                                    return (
                                                        <td key={planKey} className={cn("p-4 sm:p-5 text-center", planKey === "pro" && "bg-[#F2B33D]/5")}>
                                                            {typeof value === "boolean" ? (
                                                                value ? <Check className="h-5 w-5 text-[#C89B4A] mx-auto" /> : <X className="h-5 w-5 text-[#E11D48] mx-auto" />
                                                            ) : (
                                                                <span className="text-sm font-semibold text-card-foreground">{value}</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile */}
                        <div className="md:hidden space-y-4 max-w-lg mx-auto">
                            {(["discovery", "basic", "pro"] as const).map((planKey) => {
                                const planInfo = plans.find(p => p.key === planKey)!
                                return (
                                    <div key={planKey} className={cn("rounded-xl border bg-card p-5 shadow-sm", planKey === "pro" ? "border-[#F2B33D] shadow-md" : "border-border")}>
                                        <h3 className={cn("font-bold text-lg mb-3", planKey === "pro" ? "text-[#F2B33D]" : "text-card-foreground")}>{planInfo.name}</h3>
                                        <ul className="space-y-2.5">
                                            {comparisonFeatures.map((feature) => {
                                                const value = feature[planKey]
                                                const isIncluded = value === true || typeof value === "string"
                                                return (
                                                    <li key={feature.name} className="flex items-center gap-2.5 text-sm">
                                                        {isIncluded ? <Check className="h-4 w-4 text-[#F2B33D] shrink-0" /> : <X className="h-4 w-4 text-[#E11D48] shrink-0" />}
                                                        <span className={cn(isIncluded ? "text-card-foreground/80" : "text-muted-foreground")}>
                                                            {feature.name}
                                                            {typeof value === "string" && <span className="ml-1 font-semibold text-[#F2B33D]">({value})</span>}
                                                        </span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>
            </main>
            <Footer />

            {/* Lightbox visuels de veille */}
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogContent className="max-w-5xl w-[95vw] p-0 bg-black/95 border-white/10">
                    <DialogTitle className="sr-only">
                        {VEILLE_SLIDES[lightboxIndex]?.alt ?? "Aperçu visuel"}
                    </DialogTitle>
                    <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] md:aspect-[16/10]">
                        <Image
                            key={VEILLE_SLIDES[lightboxIndex]?.src}
                            src={VEILLE_SLIDES[lightboxIndex]?.src ?? ""}
                            alt={VEILLE_SLIDES[lightboxIndex]?.alt ?? ""}
                            fill
                            sizes="95vw"
                            className="object-contain"
                            priority
                        />
                        {VEILLE_SLIDES.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setLightboxIndex((i) => (i - 1 + VEILLE_SLIDES.length) % VEILLE_SLIDES.length)
                                    }
                                    aria-label="Visuel précédent"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-[#F2B33D] hover:text-[#0F0F0F] transition"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setLightboxIndex((i) => (i + 1) % VEILLE_SLIDES.length)
                                    }
                                    aria-label="Visuel suivant"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-[#F2B33D] hover:text-[#0F0F0F] transition"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5">
                                    {VEILLE_SLIDES.map((_, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setLightboxIndex(i)}
                                            aria-label={`Voir le visuel ${i + 1}`}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all",
                                                i === lightboxIndex ? "w-6 bg-[#F2B33D]" : "w-1.5 bg-white/50 hover:bg-white/80"
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
