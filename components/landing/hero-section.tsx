"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { ArrowRight, Play, Target, BarChart3, Search, CheckCircle, Zap, RefreshCw, Globe, Layers, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { getGoogleDriveImageUrl, fixBrokenEncoding } from "@/lib/utils"
import homepageContent from "@/lib/homepage-content.json"

function useStats() {
  const [stats, setStats] = useState({ users: 0, campaigns: 0, brands: 0, countries: 0 })

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats({ users: 0, campaigns: 0, brands: 0, countries: 0 }))
  }, [])

  return stats
}

function useRecentUsers() {
  const [recentUsers, setRecentUsers] = useState<{ initials: string }[]>([])

  useEffect(() => {
    fetch("/api/users/recent")
      .then((res) => res.json())
      .then((data) => setRecentUsers(data.users || []))
      .catch(() => setRecentUsers([]))
  }, [])

  return recentUsers
}

interface RecentCampaign {
  id: string
  title: string
  category: string | null
  thumbnail: string | null
  slug: string | null
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function useRecentCampaigns() {
  const [campaigns, setCampaigns] = useState<RecentCampaign[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("campaigns")
      .select("id, title, category, thumbnail, slug")
      .eq("status", "Publié")
      .then(({ data }) => {
        const all: RecentCampaign[] = (data || []).map((c: any) => ({
          ...c,
          title: fixBrokenEncoding(c.title),
          category: fixBrokenEncoding(c.category),
        }))
        // Affichage aléatoire : on mélange puis on prend 4
        setCampaigns(shuffleArray(all).slice(0, 4))
      })
  }, [])

  return campaigns
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return new Intl.NumberFormat("fr-FR").format(n)
  }
  return n.toString()
}

export function HeroSection() {
  const stats = useStats()
  const recentUsers = useRecentUsers()
  const recentCampaigns = useRecentCampaigns()
  const t = homepageContent.hero

  // Fallback si pas encore chargé
  const displayUsers = recentUsers.length > 0
    ? recentUsers
    : [{ initials: '...' }, { initials: '...' }, { initials: '...' }, { initials: '...' }]

  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-32 sm:pt-32 sm:pb-40 lg:pb-48">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245, 245, 245,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(245, 245, 245,0.3)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">

          {/* Text Content */}
          <div className="flex flex-col items-start text-left z-10">
            {/* Value Proposition Banner */}
            <div className="mb-6 w-full sm:w-auto animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F2B33D]/15 to-[#F2B33D]/5 px-5 py-3 ring-2 ring-[#F2B33D]/20 shadow-lg shadow-[#F2B33D]/10">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2B33D] text-white">
                  <CheckCircle className="h-5 w-5" />
                </span>
                <span className="text-base font-bold text-[#0F0F0F]">
                  {t.badge}
                </span>
              </div>
            </div>

            <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold tracking-tight text-[#0F0F0F] sm:text-6xl lg:text-7xl leading-[1.1] animate-fade-in-up delay-100">
              {t.title.line1}<br />
              <span className="text-[#F2B33D] relative inline-block">
                 {t.title.highlight}
                <span className="absolute -bottom-2 left-0 w-full h-2 bg-[#F2B33D]/20 -rotate-1 rounded-full blur-sm"></span>
              </span> <br />
              {t.title.line3}
            </h1>

            <p className="mt-8 max-w-xl text-lg text-[#0F0F0F]/70 leading-relaxed animate-fade-in-up delay-200">
              {t.subtitle}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row animate-fade-in-up delay-300 w-full sm:w-auto">
              <Button size="lg" asChild className="group h-14 px-8 text-base font-bold bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white shadow-xl shadow-[#F2B33D]/20 transition-all duration-300 hover:scale-[1.02]">
                <Link href="/pricing">
                  {t.cta.primary}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              {/* Bouton masqué en attendant la vidéo de présentation dynamique
              <Button size="lg" variant="outline" asChild className="group h-14 px-8 text-base font-semibold border-[#F5F5F5] bg-white text-[#0F0F0F] hover:bg-[#F5F5F5]/50 hover:border-[#F5F5F5] transition-all duration-300">
                <Link href="/dashboard">
                  <Play className="mr-2 h-5 w-5 fill-current text-[#F2B33D] opacity-80" />
                  {t.cta.secondary}
                </Link>
              </Button>
              */}
            </div>

            {/* Price info below buttons */}
            <br/>
            <p className="mt-4 text-sm text-[#0F0F0F]/60 animate-fade-in-up delay-300">
              {t.price.label} <span className="font-semibold text-foreground">{t.price.amount}</span> {t.price.suffix}
            </p>

            <div className="mt-10 flex items-center gap-6 animate-fade-in-up delay-400">
              <div className="flex -space-x-3">
                {displayUsers.map((user, i) => (
                  <div key={i} className={`h-10 w-10 rounded-full border-2 border-background bg-[#F2B33D]/20 z-${10 - i} flex items-center justify-center text-xs font-bold text-[#F2B33D]`}>
                    {user.initials}
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex gap-1 text-[#F2B33D]">
                  {t.socialProof.rating}
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {t.socialProof.label} <span className="text-foreground font-bold">{stats.users > 0 ? `${formatNumber(stats.users)}+` : '...'}</span> {t.socialProof.suffix}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Content - Floating Interface */}
          <div className="relative animate-slide-in-right delay-200 hidden lg:block perspective-1000">
            {/* Subtle decorative elements */}
            <div className="absolute -top-12 -right-12 h-64 w-64 bg-[#F5F5F5]/50 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-8 -left-8 h-48 w-48 bg-[#F2B33D]/10 rounded-full blur-3xl"></div>

            <div className="glass-panel rounded-2xl p-4 transform rotate-y-[-5deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-0 hover:scale-[1.02]">
              <div className="rounded-xl bg-white border border-[#F5F5F5] shadow-2xl overflow-hidden">
                {/* Window Header */}
                <div className="flex items-center justify-between border-b border-[#F5F5F5] bg-[#F5F5F5]/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
                    <div className="h-3 w-3 rounded-full bg-[#F2B33D]" />
                    <div className="h-3 w-3 rounded-full bg-[#10B981]" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1 text-xs font-medium text-[#0F0F0F]/70 border border-[#F5F5F5] shadow-sm">
                      <Search className="h-3 w-3" />
                      {t.browserBar}
                    </div>
                  </div>
                  <div className="w-12"></div>
                </div>

                {/* Dashboard Preview Content */}
                <div className="p-6 bg-white">
                  <div className="mb-6 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {t.filters.map((filter, i) => (
                      <span key={i} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${i === 0 ? 'bg-[#F2B33D] text-white shadow-lg shadow-[#F2B33D]/25' : 'bg-[#F5F5F5] text-[#0F0F0F] hover:bg-[#F5F5F5]/80'}`}>
                        {filter}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    {recentCampaigns.length > 0
                      ? recentCampaigns.map((campaign) => (
                        <Link key={campaign.id} href={`/content/${campaign.slug || campaign.id}`} className="group cursor-pointer rounded-xl border border-[#F5F5F5] bg-white p-3 transition-all hover:shadow-lg hover:-translate-y-1">
                          <div className="aspect-[16/10] w-full rounded-lg bg-[#F5F5F5] relative overflow-hidden">
                            {campaign.thumbnail ? (
                              <Image
                                src={getGoogleDriveImageUrl(campaign.thumbnail)}
                                alt={campaign.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="absolute inset-0 bg-[#F2B33D]/25 flex items-center justify-center text-[#0F0F0F]/80 text-xs font-bold">
                                {campaign.title.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                                {t.cardOverlay}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 px-1">
                            <h4 className="font-semibold text-sm text-[#0F0F0F] line-clamp-1">{campaign.title}</h4>
                            <span className="text-xs text-[#0F0F0F]/60">{campaign.category || "Campagne"}</span>
                          </div>
                        </Link>
                      ))
                      : /* Skeleton placeholders while loading */
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-[#F5F5F5] bg-white p-3">
                          <div className="aspect-[16/10] w-full rounded-lg skeleton-shimmer" />
                          <div className="mt-3 px-1 space-y-1.5">
                            <div className="skeleton-line h-4 w-3/4 rounded" />
                            <div className="skeleton-line h-3 w-1/2 rounded" />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 bg-white p-4 rounded-xl shadow-xl border border-[#F5F5F5] animate-float hidden xl:block">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-[#0F0F0F]/60">{t.floatingBadge.label}</div>
                  <div className="text-sm font-bold text-[#0F0F0F]">{t.floatingBadge.value}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection() {
  const stats = useStats()
  const t = homepageContent.features

  const iconMap: Record<string, any> = { Target, Layers, Zap }

  const features = t.items.map((item) => ({
    icon: iconMap[item.icon] || Target,
    title: item.title,
    description: item.icon === "Layers"
      ? (stats.campaigns > 0
        ? (item as any).descriptionTemplate?.replace('{count}', formatNumber(stats.campaigns)) || item.description
        : (item as any).descriptionFallback || item.description)
      : item.description,
    color: item.color,
    bg: item.bg,
  }))

  return (
    <section className="py-24 bg-[#F5F5F5]/30 relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245, 245, 245,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(245, 245, 245,0.5)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[#0F0F0F] sm:text-4xl">
            {t.title} <span className="text-[#F2B33D]">{t.titleHighlight}</span>{t.titleSuffix}
          </h2>
          <p className="mt-4 text-lg text-[#0F0F0F]/70">
            {t.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white p-8 rounded-2xl border border-[#F5F5F5] shadow-sm hover:shadow-lg hover:border-[#F2B33D]/30 transition-all group">
              <div className={`h-12 w-12 rounded-xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[#0F0F0F]">{feature.title}</h3>
              <p className="text-[#0F0F0F]/70 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PreviewSection() {
  const t = homepageContent.preview
  const recentCampaigns = useRecentCampaigns()

  return (
    <section className="py-24 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          <div className="lg:col-span-6 mb-12 lg:mb-0">
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[#0F0F0F] sm:text-4xl mb-6">
              {t.title} <span className="text-[#F2B33D]">{t.titleHighlight}</span>.
            </h2>
            <p className="text-lg text-[#0F0F0F]/70 mb-8">
              {t.subtitle}
            </p>

            <ul className="space-y-4">
              {t.features.map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[#10B981]" />
                  <span className="text-[#0F0F0F]/80 font-medium">{item}</span>
                </li>
              ))}
            </ul>

{/*             <div className="mt-10">
              <Button variant="ghost" className="text-[#F2B33D] hover:text-[#F2B33D]/80 hover:bg-[#F2B33D]/5 p-0 font-semibold group">
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div> */}
          </div>

          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-[#F5F5F5]/30 blur-3xl rounded-full opacity-50" />
            <div className="relative rounded-xl border border-[#F5F5F5] shadow-2xl overflow-hidden">
              <Image
                src="/anu.png"
                alt="Aperçu de la plateforme Laveiye"
                width={800}
                height={600}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function PricingTeaser() {
  const t = homepageContent.pricingTeaser

  return (
    <section className="py-16 sm:py-20 bg-[#F5F5F5]/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245, 245, 245,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(245, 245, 245,0.3)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col items-center relative z-10">
        {/* Pricing teaser */}
        <div className="mb-5 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#F2B33D]/15 to-[#F2B33D]/5 px-5 py-2.5 ring-2 ring-[#F2B33D]/20 shadow-lg">
          <span className="text-base font-bold text-[#0F0F0F]">
            {t.badge}
          </span>
        </div>

        <h2 id="samer" className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold mb-4 text-[#0F0F0F] mb text-center animate-fade-in-up">
          {t.title}
        </h2>
       
        <p id="lagross" className="text-[#0F0F0F]/70 text-lg sm:text-xl mb-8 max-w-2xl mx-auto text-center">
          {t.subtitle}
        </p>
 <br/>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="h-14 px-8 text-lg bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white font-bold rounded-full shadow-lg shadow-[#F2B33D]/25 hover:shadow-[#F2B33D]/40 transition-all hover:-translate-y-1" asChild>
            <Link href="/pricing">
              {t.cta.primary}
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-[#0F0F0F]/30 text-[#0F0F0F] hover:bg-[#0F0F0F]/10 rounded-full" asChild>
            <Link href="/pricing">
              {t.cta.secondary}
            </Link>
          </Button>
        </div>

        <p className="mt-5 text-sm text-[#0F0F0F]/50">
        </p>
      </div>
    </section>
  )
}
