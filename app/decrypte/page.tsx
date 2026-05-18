"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Crown,
  Lock,
  Loader2,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthContext } from "@/components/auth-provider"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { resolveTier } from "@/lib/quotas"
import { Footer } from "@/components/footer"

type FormState = {
  fullName: string
  phone: string
  company: string
  jobTitle: string
  topicsOfInterest: string
  preferredChannel: string
  consentContact: boolean
}

type DecrypteSession = {
  id: string
  title: string
  description: string | null
  scheduled_at: string | null
  session_month: string
  meeting_url: string | null
  max_seats: number | null
  status: 'open' | 'closed'
  campaign_ids: string[]
  campaign_titles: string[]
  registered: boolean
  seats_taken: number
  seats_remaining: number | null
}

const INITIAL_FORM: FormState = {
  fullName: "",
  phone: "",
  company: "",
  jobTitle: "",
  topicsOfInterest: "",
  preferredChannel: "email",
  consentContact: false,
}

export default function DecryptePage() {
  const router = useRouter()
  const { user, userProfile, loading: authLoading } = useAuthContext()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [alreadyRegistered, setAlreadyRegistered] = useState<{
    id: string
    sessionMonth: string
  } | null>(null)
  const [checking, setChecking] = useState(true)
  const [justRegistered, setJustRegistered] = useState(false)
  const [sessions, setSessions] = useState<DecrypteSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)

  // Resolve effective tier from profile (Pro-only access)
  const tier = resolveTier(
    userProfile?.plan,
    userProfile?.subscription_status as any
  )
  const isPro = tier === "pro"

  // Redirect to login if needed
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/decrypte")
    }
  }, [authLoading, user, router])

  // Pre-fill from profile and check existing registration
  useEffect(() => {
    if (!user) return
    if (userProfile?.name) {
      setForm((f) => (f.fullName ? f : { ...f, fullName: userProfile.name as string }))
    }
    setChecking(false)
  }, [user, userProfile])

  // Load admin-defined sessions (refetch on demand to refresh `registered` flags)
  const loadSessions = async () => {
    try {
      const res = await fetch("/api/decrypte/sessions", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const list: DecrypteSession[] = Array.isArray(data?.sessions) ? data.sessions : []
        setSessions(list)
        // Pre-selectionne la premiere seance ouverte non pleine et non deja prise
        const firstAvailable = list.find(
          (s) =>
            s.status === 'open' &&
            !s.registered &&
            (s.seats_remaining == null || s.seats_remaining > 0)
        )
        setSelectedSessionId((current) => {
          if (current && list.find((s) => s.id === current && !s.registered)) return current
          return firstAvailable ? firstAvailable.id : null
        })
      }
    } catch {
      // best-effort
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!form.fullName.trim()) {
      setSubmitError("Nom complet requis")
      return
    }
    if (!form.consentContact) {
      setSubmitError(
        "Merci de confirmer que vous acceptez d'etre contacte par l'equipe Big Five."
      )
      return
    }

    // Si des seances ouvertes existent, l'utilisateur doit en choisir une
    const openSessions = sessions.filter(
      (s) => s.status === 'open' && !s.registered
    )
    if (openSessions.length > 0 && !selectedSessionId) {
      setSubmitError("Merci de choisir une seance.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/decrypte/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sessionId: selectedSessionId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(
          data?.error || data?.message || "Impossible d'enregistrer l'inscription."
        )
        return
      }
      setJustRegistered(true)
      setAlreadyRegistered({ id: data.id, sessionMonth: data.sessionMonth })
      // Refresh sessions so the just-registered one becomes "Deja inscrit"
      // et que l'utilisateur puisse en choisir une autre.
      await loadSessions()
      setSelectedSessionId(null)
    } catch (err: any) {
      setSubmitError(err?.message || "Erreur reseau")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-white">
        <DashboardNavbar />
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#F2B33D]" />
          </div>
        </div>
      </div>
    )
  }

  // Pro gate
  if (!isPro) {
    return (
      <div className="min-h-screen bg-white">
        <DashboardNavbar />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </Link>

          <div className="mt-8 rounded-3xl border-2 border-[#F2B33D]/30 bg-gradient-to-br from-[#FFFBEC] via-white to-[#FFF6E5] p-8 sm:p-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[#0F0F0F] mb-3">
              Plan Pro requis
            </h1>
            <p className="text-[#0F0F0F]/70 text-base mb-6 max-w-xl mx-auto">
              <strong className="text-[#F2B33D]">#BigFiveDecrypte</strong> est la
              session mensuelle de debrief animee par un expert Big Five. Elle est
              reservee aux abonnes Pro. Inscrivez-vous au plan Pro pour acceder a la
              prochaine session.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="h-11 px-6 bg-[#F2B33D] hover:bg-[#d99a2a] text-white font-semibold"
                onClick={() => router.push("/subscribe?plan=pro")}
              >
                <Crown className="mr-2 h-4 w-4" />
                Passer en Pro
              </Button>
              <Button
                variant="outline"
                className="h-11 px-6"
                onClick={() => router.push("/dashboard")}
              >
                Retour
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Pro user — show registration form or confirmation
  return (
    <div className="min-h-screen bg-white">
      <DashboardNavbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>

        <header className="mt-8 mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F2B33D]/10 px-3 py-1 text-xs font-semibold text-[#a17320] mb-3">
            <Crown className="h-3.5 w-3.5" />
            Reserve aux abonnes Pro
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold tracking-tight text-[#0F0F0F]">
            #BigFiveDecrypte
          </h1>
          <p className="mt-3 text-base text-[#0F0F0F]/70 max-w-2xl">
            Une session mensuelle animee par un expert Big Five. Choisissez les
            campagnes que vous souhaitez decrypter, laissez-nous vos coordonnees,
            l'equipe vous envoie le lien de connexion (Zoom / Meet) avant la
            seance.
          </p>
        </header>

        {checking ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#F2B33D]" />
          </div>
        ) : (() => {
          const registeredCount = sessions.filter((s) => s.registered).length
          const availableOpen = sessions.filter(
            (s) =>
              s.status === "open" &&
              !s.registered &&
              (s.seats_remaining == null || s.seats_remaining > 0)
          )
          const noMoreAvailable = registeredCount > 0 && availableOpen.length === 0

          return (
            <>
              {registeredCount > 0 && (
                <div className="mb-6 rounded-2xl border-2 border-[#10B981]/30 bg-gradient-to-br from-[#10B981]/5 to-white p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#10B981]/15">
                      <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-[#0F0F0F]">
                        {justRegistered
                          ? "Inscription confirmee"
                          : `Inscrit a ${registeredCount} seance${registeredCount > 1 ? "s" : ""}`}
                      </h2>
                      <p className="text-sm text-[#0F0F0F]/70 mt-1">
                        L'equipe Big Five vous contactera par email avec le lien
                        de connexion avant chaque seance.
                        {availableOpen.length > 0 && (
                          <> Vous pouvez vous inscrire a une autre seance ci-dessous.</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {noMoreAvailable ? (
                <div className="rounded-3xl border border-[#F5F5F5] bg-white p-6 sm:p-8 text-center">
                  <p className="text-[#0F0F0F]/70">
                    Vous etes inscrit a toutes les seances actuellement ouvertes.
                    De nouvelles dates seront annoncees prochainement.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5 h-11 px-6"
                    onClick={() => router.push("/dashboard")}
                  >
                    Retour au dashboard
                  </Button>
                </div>
              ) : (
                <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-[#F5F5F5] bg-white p-6 sm:p-8 shadow-sm space-y-5"
          >
            {/* Selecteur de seance */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Choisissez une seance
              </Label>
              {sessionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des seances...
                </div>
              ) : sessions.filter((s) => s.status === "open").length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#F2B33D]/40 bg-[#FFFBEC] p-4 text-sm text-[#0F0F0F]/70">
                  Aucune seance n'est ouverte aux inscriptions pour le moment.
                  Laissez-nous vos coordonnees ci-dessous, l'equipe Big Five vous
                  informera de la prochaine date.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions
                    .filter((s) => s.status === "open" || s.status === "closed")
                    .map((s) => {
                      const full =
                        s.seats_remaining != null && s.seats_remaining <= 0
                      const disabled =
                        s.status !== "open" || s.registered || full
                      const dateLabel = s.scheduled_at
                        ? new Date(s.scheduled_at).toLocaleString("fr-FR", {
                            dateStyle: "long",
                            timeStyle: "short",
                          })
                        : `Session ${s.session_month}`
                      return (
                        <label
                          key={s.id}
                          className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                            selectedSessionId === s.id
                              ? "border-[#F2B33D] bg-[#FFFBEC]"
                              : "border-[#F5F5F5] bg-white hover:border-[#F2B33D]/40"
                          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="radio"
                            name="session"
                            value={s.id}
                            checked={selectedSessionId === s.id}
                            disabled={disabled}
                            onChange={() => setSelectedSessionId(s.id)}
                            className="mt-1 h-4 w-4 accent-[#F2B33D]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[#0F0F0F]">
                                {s.title}
                              </span>
                              {s.registered && (
                                <span className="rounded-full bg-[#10B981]/15 px-2 py-0.5 text-xs font-semibold text-[#10B981]">
                                  Deja inscrit
                                </span>
                              )}
                              {s.status === "closed" && (
                                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                  Inscriptions fermees
                                </span>
                              )}
                              {full && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  Complete
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-sm text-[#0F0F0F]/70 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {dateLabel}
                            </div>
                            {s.description && (
                              <p className="mt-1.5 text-sm text-[#0F0F0F]/70 line-clamp-2">
                                {s.description}
                              </p>
                            )}
                            {s.campaign_titles?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {s.campaign_titles.slice(0, 5).map((t, i) => (
                                  <span
                                    key={i}
                                    className="rounded bg-[#F5F5F5] px-2 py-0.5 text-xs text-[#0F0F0F]/80"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {s.campaign_titles.length > 5 && (
                                  <span className="text-xs text-[#0F0F0F]/60">
                                    +{s.campaign_titles.length - 5}
                                  </span>
                                )}
                              </div>
                            )}
                            {s.max_seats != null && (
                              <div className="mt-1.5 text-xs text-[#0F0F0F]/60">
                                {s.seats_taken}/{s.max_seats} places prises
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="fullName" className="text-sm font-semibold">
                  Nom complet *
                </Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  placeholder="Aminata Kone"
                  required
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-semibold">
                  Telephone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+225 07 00 00 00 00"
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="company" className="text-sm font-semibold">
                  Entreprise / organisation
                </Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                  placeholder="Big Five Abidjan"
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="jobTitle" className="text-sm font-semibold">
                  Fonction
                </Label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, jobTitle: e.target.value }))
                  }
                  placeholder="Directrice creative"
                  className="mt-1.5 h-11"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="topicsOfInterest" className="text-sm font-semibold">
                Campagnes ou sujets a decrypter
              </Label>
              <textarea
                id="topicsOfInterest"
                value={form.topicsOfInterest}
                onChange={(e) =>
                  setForm((f) => ({ ...f, topicsOfInterest: e.target.value }))
                }
                rows={4}
                placeholder="Ex : la campagne X de la marque Y, le format Reels du secteur banque..."
                className="mt-1.5 w-full rounded-lg border border-[#F5F5F5] bg-white px-3 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20"
              />
            </div>

            <div>
              <Label htmlFor="preferredChannel" className="text-sm font-semibold">
                Canal de contact prefere
              </Label>
              <select
                id="preferredChannel"
                value={form.preferredChannel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredChannel: e.target.value }))
                }
                className="mt-1.5 h-11 w-full rounded-lg border border-[#F5F5F5] bg-white px-3 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20"
              >
                <option value="email">Email</option>
                <option value="phone">Telephone</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            <label className="flex items-start gap-3 rounded-lg bg-[#F5F5F5]/40 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consentContact}
                onChange={(e) =>
                  setForm((f) => ({ ...f, consentContact: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 accent-[#F2B33D]"
              />
              <span className="text-sm text-[#0F0F0F]/80">
                J'accepte d'etre contacte par l'equipe Big Five pour recevoir le
                lien de connexion a la session #BigFiveDecrypte et les
                informations associees.
              </span>
            </label>

            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-6 bg-[#F2B33D] hover:bg-[#d99a2a] text-white font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Reserver ma place
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6"
                onClick={() => router.push("/dashboard")}
              >
                Annuler
              </Button>
            </div>
          </form>
              )}
            </>
          )
        })()}

        <p className="mt-6 text-xs text-[#0F0F0F]/50 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          La session est animee mensuellement. Le lien de connexion est envoye
          quelques jours avant la seance.
        </p>
      </div>
      <Footer />
    </div>
  )
}
