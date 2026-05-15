import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Sparkles } from "lucide-react"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { Button } from "@/components/ui/button"
import { getTempsFortStatus, getTodayISO } from "@/lib/temps-forts"
import { fetchAllTempsForts, fetchTempsFortBySlug, fetchCampaignsByTempsFortSlug } from "@/lib/temps-forts-server"
import { getGoogleDriveImageUrl } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface TempsFortDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: TempsFortDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const tempsFort = await fetchTempsFortBySlug(slug)

  if (!tempsFort) {
    return {
      title: "Temps fort introuvable - Laveiye",
    }
  }

  return {
    title: `${tempsFort.shortTitle || tempsFort.title} - Temps forts Laveiye`,
    description: tempsFort.description,
  }
}

export default async function TempsFortDetailPage({ params }: TempsFortDetailPageProps) {
  const { slug } = await params
  const [tempsFort, allTempsForts, campaigns] = await Promise.all([
    fetchTempsFortBySlug(slug),
    fetchAllTempsForts(),
    fetchCampaignsByTempsFortSlug(slug),
  ])

  if (!tempsFort) notFound()

  const today = getTodayISO()
  const status = getTempsFortStatus(tempsFort, today)
  const relatedTempsForts = allTempsForts
    .filter((item) => item.id !== tempsFort.id && item.category === tempsFort.category)
    .slice(0, 3)

  return (
    <SubscriptionGuard>
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-[#F5F5F5]/40">
      <DashboardNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="mb-5 px-0 font-bold text-[#0F0F0F]/65 hover:bg-transparent hover:text-[#F2B33D]">
          <Link href="/temps-forts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tous les temps forts
          </Link>
        </Button>

        <section className="grid overflow-hidden rounded-2xl border border-[#F5F5F5] bg-white shadow-sm lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[360px] overflow-hidden lg:min-h-[560px]">
            <Image
              src={tempsFort.heroImageUrl || tempsFort.imageUrl}
              alt={tempsFort.shortTitle || tempsFort.title}
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center gap-3">
              <StatusPill status={status} />
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                {tempsFort.category}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F2B33D]/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0F0F0F]">
              <Sparkles className="h-3.5 w-3.5 text-[#F2B33D]" />
              Temps fort
            </div>
            <h1 className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-tight text-[#0F0F0F] sm:text-5xl">
              {tempsFort.shortTitle || tempsFort.title}
            </h1>
            <p className="mt-4 text-lg font-medium leading-relaxed text-[#0F0F0F]/70">
              {tempsFort.description}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Campagnes associées" value={`${campaigns.length}`} />
              <InfoTile label="Date de l'événement" value={formatLongDate(tempsFort.eventDate)} />
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {tempsFort.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#F5F5F5] px-3 py-1 text-sm font-bold text-[#0F0F0F]/75">
                  {tag}
                </span>
              ))}
            </div>

            <Button asChild className="mt-8 h-12 w-fit rounded-lg bg-[#0F0F0F] px-5 font-bold text-white hover:bg-[#0F0F0F]/90">
              <Link href={`/dashboard?temps_fort=${tempsFort.slug}`}>
                Voir dans le dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#0F0F0F]">
              Campagnes liées à ce temps fort
            </h2>
            <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-sm font-bold text-[#0F0F0F]/65">
              {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
            </span>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#F2B33D]/40 bg-[#F2B33D]/5 p-8 text-center">
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#0F0F0F]">
                Aucune campagne associée pour le moment
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#0F0F0F]/60">
                Associez des campagnes à ce temps fort depuis l'admin pour les voir apparaître ici.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {campaigns.map((campaign) => (
                <CampaignTile key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <GuidanceCard title="À surveiller" items={tempsFort.axes} />
          <GuidanceCard title="Secteurs pertinents" items={tempsFort.sectors} />
          <GuidanceCard title="Formats à explorer" items={tempsFort.formats} />
        </section>

        {relatedTempsForts.length > 0 && (
          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#0F0F0F]">
              Autres temps forts {tempsFort.category.toLowerCase()}
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedTempsForts.map((item) => (
                <Link key={item.id} href={`/temps-forts/${item.slug}`} className="group overflow-hidden rounded-xl border border-[#F5F5F5] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative aspect-[4/3]">
                    <Image src={item.imageUrl} alt={item.shortTitle || item.title} fill sizes="33vw" className="object-cover transition group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#0F0F0F]">{item.shortTitle || item.title}</h3>
                    <p className="mt-1 text-sm font-bold text-[#0F0F0F]/60">{item.campaignCount} campagne{item.campaignCount > 1 ? "s" : ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
    </SubscriptionGuard>
  )
}

function CampaignTile({ campaign }: { campaign: any }) {
  const slugOrId = campaign.slug || campaign.id
  const thumbnail = getGoogleDriveImageUrl(campaign.thumbnail || "/placeholder.png")
  const title = campaign.title || "Campagne"
  const brand = campaign.brand || ""
  const country = campaign.country || ""
  const sector = campaign.category || ""

  return (
    <Link href={`/content/${slugOrId}`} className="group block">
      <article className="overflow-hidden rounded-xl border border-[#F5F5F5] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
          {thumbnail && (
            <Image
              src={thumbnail}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <div className="p-4">
          {brand && <p className="text-xs font-bold uppercase tracking-wide text-[#0F0F0F]/55">{brand}</p>}
          <h3 className="mt-1 line-clamp-2 font-[family-name:var(--font-heading)] text-base font-extrabold text-[#0F0F0F]">
            {title}
          </h3>
          <div className="mt-3 flex items-center justify-between gap-2">
            {sector && (
              <span className="rounded-full bg-[#F5F5F5] px-2.5 py-0.5 text-[11px] font-bold text-[#0F0F0F]/75">
                {sector}
              </span>
            )}
            {country && (
              <span className="text-[11px] font-bold text-[#0F0F0F]/55">{country}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#F5F5F5] bg-[#F5F5F5]/45 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-[#0F0F0F]/45">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#0F0F0F]">{value}</p>
    </div>
  )
}

function GuidanceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-xl border border-[#F5F5F5] bg-white p-5 shadow-sm">
      <h3 className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#0F0F0F]">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.slice(0, 4).map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-bold text-[#0F0F0F]/70">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F2B33D]" />
            {item}
          </div>
        ))}
      </div>
    </article>
  )
}

function StatusPill({ status }: { status: "active" | "upcoming" | "past" }) {
  const label = status === "active" ? "Actif" : status === "upcoming" ? "À venir" : "Passé"
  const className = status === "active" ? "bg-[#F2B33D] text-[#0F0F0F]" : status === "upcoming" ? "bg-emerald-500 text-white" : "bg-white text-[#0F0F0F]"

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-extrabold shadow-sm ${className}`}>
      <Calendar className="h-4 w-4" />
      {label}
    </span>
  )
}

function formatLongDate(dateString: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateString}T12:00:00`))
}
