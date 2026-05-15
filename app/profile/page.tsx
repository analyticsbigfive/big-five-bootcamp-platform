"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Mail, Check, ArrowRight, Loader2, Lock, AlertTriangle, Receipt, Download, FileText, RefreshCw, TrendingUp, CreditCard, Camera, KeyRound, Search as SearchIcon, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { getPlanConfig } from "@/lib/pricing"

interface UserProfile {
  name: string
  email: string
  avatar: string
  status: "subscribed" | "expired" | "none"
  subscriptionEndDate: string
  plan?: string
  monthlyUsage?: number
}

interface PaymentRecord {
  id: string
  ref_command: string
  amount: number
  status: string
  payment_method?: string
  created_at: string
}

interface SearchLogRecord {
  id: string
  query: string | null
  filters: Record<string, unknown> | null
  source: string | null
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchLogRecord[]>([])
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false)
  const [isRefreshingSearches, setIsRefreshingSearches] = useState(false)

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Password change
  const [pwdCurrent, setPwdCurrent] = useState("")
  const [pwdNew, setPwdNew] = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [isChangingPwd, setIsChangingPwd] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null)

  // User data from Supabase
  const [user, setUser] = useState<UserProfile>({
    name: "",
    email: "",
    avatar: "",
    status: "none",
    subscriptionEndDate: "",
    plan: "",
    monthlyUsage: 0,
  })

  // Charger les données utilisateur depuis Supabase
  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push("/login")
        return
      }

      // Charger le profil depuis la table users
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()

      // Vérifier aussi les paiements confirmés (table payments est indexée par user_email)
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, ref_command, amount, created_at, status, payment_method")
        .eq("user_email", authUser.email)
        .order("created_at", { ascending: false })
        .limit(10)

      if (paymentsData) {
        setPayments(paymentsData)
      }

      // Calculer le statut d'abonnement
      let status: "subscribed" | "expired" | "none" = "none"
      let subscriptionEndDate = ""

      // plan = null => compte verrouille (pas d'abonnement actif). Pas de fallback Decouverte.
      let planName = profile?.plan || ""
      let monthlyUsage = 0

      if (profile) {
        const subStatus = String(profile.subscription_status || "").toLowerCase()
        const endDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null
        const isActive = subStatus === "active" && endDate && endDate.getTime() > Date.now()

        if (isActive) {
          status = "subscribed"
        } else if (subStatus === "expired" || subStatus === "cancelled" || (endDate && endDate.getTime() <= Date.now())) {
          status = "expired"
        } else {
          status = "none"
        }

        // La date de fin est toujours affichee si on l'a, peu importe le statut.
        if (endDate) {
          subscriptionEndDate = format(endDate, "d MMMM yyyy", { locale: fr })
        }

        // Monthly usage from profile if stored
        monthlyUsage = profile.monthly_campaigns_explored || profile.monthly_usage || 0
      }

      const userName = profile?.full_name || profile?.name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Utilisateur"
      
      setUser({
        name: userName,
        email: authUser.email || "",
        avatar: profile?.avatar_url || authUser.user_metadata?.avatar_url || "",
        status,
        subscriptionEndDate,
        plan: planName,
        monthlyUsage,
      })
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error("Erreur chargement profil:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUserData()
    loadSearchHistory()
  }, [])

  // Charger l'historique des recherches
  const loadSearchHistory = async () => {
    try {
      const res = await fetch("/api/search-history")
      if (!res.ok) return
      const data = await res.json()
      setSearchHistory(data.items || [])
    } catch (error) {
      console.error("Erreur chargement historique recherches:", error)
    }
  }

  const handleRefreshSearches = async () => {
    setIsRefreshingSearches(true)
    try {
      await loadSearchHistory()
    } finally {
      setIsRefreshingSearches(false)
    }
  }

  // Upload avatar vers le bucket "avatars"
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)

    if (!file.type.startsWith("image/")) {
      setAvatarError("Veuillez sélectionner une image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("L'image ne doit pas dépasser 5 Mo.")
      return
    }

    setIsUploadingAvatar(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setAvatarError("Session expirée. Veuillez vous reconnecter.")
        return
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const path = `${authUser.id}/avatar-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true })

      if (uploadError) {
        setAvatarError(uploadError.message || "Échec de l'upload.")
        return
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
      const publicUrl = pub.publicUrl

      // 1) On stocke toujours l'avatar dans auth.user_metadata — disponible immédiatement
      //    et lu en fallback partout (navbar, dashboard-navbar).
      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })

      // 2) On essaie aussi de mettre à jour public.users.avatar_url si la colonne existe.
      //    Si la colonne n'existe pas (PostgREST 400) ou si la policy RLS refuse, on n'échoue
      //    pas la flow : le metadata auth suffit pour afficher la photo.
      const { error: updError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", authUser.id)

      if (metaError && updError) {
        // Seul cas vraiment bloquant : aucune des deux écritures n'a réussi.
        setAvatarError("Photo téléchargée mais échec de la mise à jour du profil.")
        return
      }

      if (updError) {
        // Trace utile pour identifier la migration manquante côté DB.
        console.warn(
          "[profile] update public.users.avatar_url a échoué — fallback auth.user_metadata utilisé.",
          updError,
        )
      }

      setUser((prev) => ({ ...prev, avatar: publicUrl }))
    } catch (err: any) {
      setAvatarError(err?.message || "Erreur inattendue.")
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Changement de mot de passe
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(null)

    if (pwdNew.length < 8) {
      setPwdError("Le nouveau mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError("Les mots de passe ne correspondent pas.")
      return
    }

    setIsChangingPwd(true)
    try {
      // Re-vérifie le mot de passe actuel via signIn (Supabase n'expose pas la verification directe)
      if (pwdCurrent && user.email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: pwdCurrent,
        })
        if (signInErr) {
          setPwdError("Mot de passe actuel incorrect.")
          return
        }
      }

      const { error } = await supabase.auth.updateUser({ password: pwdNew })
      if (error) {
        setPwdError(error.message || "Impossible de mettre à jour le mot de passe.")
        return
      }
      setPwdSuccess("Mot de passe mis à jour avec succès.")
      setPwdCurrent("")
      setPwdNew("")
      setPwdConfirm("")
    } catch (err: any) {
      setPwdError(err?.message || "Erreur inattendue.")
    } finally {
      setIsChangingPwd(false)
    }
  }

  // Rafraîchir l'historique
  const handleRefreshHistory = async () => {
    setIsRefreshingHistory(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, ref_command, amount, created_at, status, payment_method")
        .eq("user_email", authUser.email)
        .order("created_at", { ascending: false })
        .limit(10)

      if (paymentsData) {
        setPayments(paymentsData)
      }
    } catch (error) {
      console.error("Erreur rafraîchissement historique:", error)
    } finally {
      setIsRefreshingHistory(false)
    }
  }

  // ─── Présentation du plan : style + libellés ke pour les 3 plans ───────────
  const planKey = (user.plan || "").toLowerCase()
  const planConfig = getPlanConfig(user.plan)
  const planName = planConfig.name // "Découverte" | "Basic" | "Pro"
  const monthlyClickLimit: number = Number.isFinite(planConfig.clicksPerMonth)
    ? (planConfig.clicksPerMonth as number)
    : Infinity
  const isUnlimited = !Number.isFinite(monthlyClickLimit)
  const monthlyUsageRaw = user.monthlyUsage || 0
  const monthlyUsage = isUnlimited
    ? monthlyUsageRaw
    : Math.min(monthlyUsageRaw, monthlyClickLimit)
  const progressPercent = isUnlimited
    ? 100
    : Math.min(100, (monthlyUsage / Math.max(1, monthlyClickLimit)) * 100)

  const planBadgeClass =
    planKey === "pro"
      ? "border-[#F2B33D] bg-[#F2B33D]/10 text-[#a17320]"
      : planKey === "basic"
        ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]"
        : "border-[#2364d7] bg-[#2364d7]/10 text-[#2364d7]"

  const planAccessLabel =
    planKey === "pro"
      ? "Accès illimité à toute la bibliothèque"
      : planKey === "basic"
        ? "Accès complet à la bibliothèque"
        : "Accès limité à la bibliothèque"

  const planAccessBoxClass =
    planKey === "pro"
      ? "bg-[#F2B33D]/10 text-[#a17320]"
      : planKey === "basic"
        ? "bg-[#10B981]/10 text-[#10B981]"
        : "bg-[#2364d7]/10 text-[#2364d7]"

  return (
    <div className="min-h-screen bg-white">
      <DashboardNavbar />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#F2B33D]" />
        </div>
      ) : (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#0F0F0F]">Mon Profil</h1>
        
        {/* Account Info Section */}
        <section className="mt-8 rounded-xl border border-[#F5F5F5] bg-white p-6 shadow-sm">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#0F0F0F]">Informations du compte</h2>
          
          <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row">
            <div className="relative">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/icons/default-avatar.svg"
                  alt={user.name}
                  className="h-20 w-20 rounded-full bg-[#F5F5F5]"
                />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label="Changer la photo de profil"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#F2B33D] text-white shadow-md hover:bg-[#F2B33D]/90 disabled:opacity-60"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                aria-label="Sélectionner une photo de profil"
              />
            </div>
            
            <div className="flex-1 space-y-4">
              {avatarError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {avatarError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-sm text-[#0F0F0F]/60">Nom complet</Label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg bg-[#F5F5F5]/20 px-3 py-2">
                    <Lock className="h-4 w-4 text-[#0F0F0F]/40" />
                    <p className="font-medium text-[#0F0F0F]">{user.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#0F0F0F]/40">Ce champ est en lecture seule</p>
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-foreground">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Abonnement — badge plan + texte d'accès pour les 3 plans */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-card-foreground">Abonnement</h2>

          <div className="mt-4 rounded-lg bg-[#F5F5F5]/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-[#F5F5F5]">
                {user.status === "subscribed" ? (
                  <Check className="h-5 w-5 text-[#0F0F0F]/60" />
                ) : (
                  <CreditCard className="h-5 w-5 text-[#0F0F0F]/60" />
                )}
              </div>
              <div className="flex-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-semibold ${planBadgeClass}`}
                >
                  <Check className="h-3 w-3" />
                  Abonné {planName}
                </span>
                <p className="mt-2 text-sm text-muted-foreground">
                  {user.status === "subscribed" && user.subscriptionEndDate ? (
                    <>Votre abonnement est actif jusqu&apos;au <span className="font-semibold text-foreground">{user.subscriptionEndDate}</span></>
                  ) : user.status === "subscribed" ? (
                    <>Votre abonnement est <span className="font-semibold text-[#10B981]">actif</span>.</>
                  ) : user.status === "expired" && user.subscriptionEndDate ? (
                    <>Votre abonnement a expiré le <span className="font-semibold text-red-600">{user.subscriptionEndDate}</span>. <Link href="/subscribe" className="font-semibold text-[#F2B33D] underline">Renouveler</Link>.</>
                  ) : user.status === "expired" ? (
                    <>Votre abonnement a expiré. <Link href="/subscribe" className="font-semibold text-[#F2B33D] underline">Renouveler</Link>.</>
                  ) : (
                    <>Choisissez une formule pour commencer.</>
                  )}
                </p>
              </div>
            </div>

            <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 ${planAccessBoxClass}`}>
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">{planAccessLabel}</span>
            </div>

            {(!planKey || planKey === "free") && (
              <Button asChild className="mt-4 w-full shadow-lg shadow-primary/25 sm:w-auto bg-[#F2B33D] hover:bg-[#F2B33D]/90">
                <Link href="/subscribe">
                  Choisir une formule
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Activité mensuelle — appliquée aux 3 plans */}
        <section className="mt-6 rounded-xl border border-[#F2B33D]/20 bg-gradient-to-br from-[#F2B33D]/5 to-[#a855f7]/5 p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#0F0F0F] flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#F2B33D]" />
            Votre activité du mois
          </h2>
          <div className="mt-6 flex items-end gap-3">
            <span className="font-[family-name:var(--font-heading)] text-6xl font-extrabold text-[#F2B33D]">
              {monthlyUsage}
            </span>
            {!isUnlimited && (
              <span className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[#F2B33D]/60 mb-1">
                /{monthlyClickLimit}
              </span>
            )}
            <div className="mb-2">
              <p className="text-base font-semibold text-[#0F0F0F]">campagnes explorées</p>
              <p className="text-sm text-[#0F0F0F]/60">· réinitialise chaque mois</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F2B33D]/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F2B33D] to-[#a855f7] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#0F0F0F]/50">
            {isUnlimited
              ? "Ce compteur suit vos consultations de campagnes du mois en cours. Votre plan inclut un accès illimité."
              : "Ce compteur suit vos consultations de campagnes du mois en cours."}
          </p>
          {!isUnlimited && monthlyUsage >= monthlyClickLimit && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700">
                Limite mensuelle atteinte. <Link href="/pricing" className="font-semibold underline">Passez à un plan supérieur</Link> pour continuer à explorer.
              </p>
            </div>
          )}
        </section>

        {/* Recent History - Dynamic from Supabase payments */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-card-foreground">Historique récent</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshHistory}
              disabled={isRefreshingHistory}
              className="bg-white border-[#F5F5F5] text-[#0F0F0F]"
            >
              {isRefreshingHistory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Actualiser</span>
            </Button>
          </div>
          
          <div className="mt-4">
            {payments.length > 0 ? (
              <div className="divide-y divide-border">
                {payments.map((payment) => {
                  const date = new Date(payment.created_at)
                  const isCompleted = payment.status === "completed"
                  const now = new Date()
                  const diffMs = now.getTime() - date.getTime()
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                  let dateLabel = ""
                  if (diffHours < 1) dateLabel = "À l'instant"
                  else if (diffHours < 24) dateLabel = `Il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`
                  else if (diffDays === 1) dateLabel = "Hier"
                  else if (diffDays < 7) dateLabel = `Il y a ${diffDays} jours`
                  else dateLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isCompleted ? "bg-emerald-100" : "bg-amber-100"
                        }`}>
                          <FileText className={`h-4 w-4 ${isCompleted ? "text-emerald-600" : "text-amber-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            Paiement {payment.amount?.toLocaleString("fr-FR")} FCFA
                            {payment.payment_method ? ` · ${payment.payment_method}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Réf: {payment.ref_command}
                            {" · "}
                            <span className={isCompleted ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                              {isCompleted ? "Complété" : payment.status === "pending" ? "En attente" : payment.status}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{dateLabel}</span>
                        {isCompleted && (
                          <>
                            <a
                              href={`/api/payment/receipt/${payment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Receipt className="h-3 w-3" />
                              Reçu
                            </a>
                            <a
                              href={`/api/payment/receipt/${payment.id}?download=1`}
                              className="flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              Télécharger
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Receipt className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
                <p className="mt-1 text-xs text-muted-foreground">Votre historique de paiements apparaîtra ici</p>
              </div>
            )}
          </div>
        </section>

        {/* Historique des recherches détaillé */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-card-foreground flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-[#2364d7]" />
              Historique des recherches
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshSearches}
              disabled={isRefreshingSearches}
              className="bg-white border-[#F5F5F5] text-[#0F0F0F]"
            >
              {isRefreshingSearches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Actualiser</span>
            </Button>
          </div>

          <div className="mt-4">
            {searchHistory.length > 0 ? (
              <div className="divide-y divide-border">
                {searchHistory.map((log) => {
                  const date = new Date(log.created_at)
                  const dateLabel = date.toLocaleDateString("fr-FR", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                  const filtersObj = (log.filters && typeof log.filters === "object") ? log.filters as Record<string, unknown> : {}
                  const filterEntries = Object.entries(filtersObj).filter(([k, v]) => {
                    if (k === "filterId") return false
                    if (Array.isArray(v)) return v.length > 0
                    return v !== null && v !== undefined && v !== ""
                  })
                  return (
                    <div key={log.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <SearchIcon className="h-4 w-4 text-[#0F0F0F]/40 shrink-0" />
                            <p className="text-sm font-medium text-foreground truncate">
                              {log.query ? `« ${log.query} »` : <span className="italic text-muted-foreground">Recherche par filtres</span>}
                            </p>
                            {log.source && (
                              <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-medium text-[#0F0F0F]/60">
                                {log.source === "bar" ? "Barre" : log.source === "filter" ? "Filtre" : log.source}
                              </span>
                            )}
                          </div>
                          {filterEntries.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                              {filterEntries.map(([key, val]) => {
                                const display = Array.isArray(val) ? val.join(", ") : String(val)
                                return (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2364d7]/10 px-2 py-0.5 text-[11px] text-[#2364d7]"
                                  >
                                    <span className="font-semibold">{key}:</span> {display}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <SearchIcon className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-muted-foreground">Aucune recherche enregistrée</p>
                <p className="mt-1 text-xs text-muted-foreground">Vos requêtes et filtres apparaîtront ici</p>
              </div>
            )}
          </div>
        </section>

        {/* Sécurité — changement de mot de passe */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-card-foreground flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#F2B33D]" />
            Sécurité
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Modifier votre mot de passe</p>

          <form onSubmit={handleChangePassword} className="mt-4 space-y-3 max-w-md">
            <div>
              <Label htmlFor="pwd-current" className="text-sm text-[#0F0F0F]/70">Mot de passe actuel</Label>
              <Input
                id="pwd-current"
                type={showPwd ? "text" : "password"}
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
                autoComplete="current-password"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pwd-new" className="text-sm text-[#0F0F0F]/70">Nouveau mot de passe</Label>
              <Input
                id="pwd-new"
                type={showPwd ? "text" : "password"}
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">Au moins 8 caractères.</p>
            </div>
            <div>
              <Label htmlFor="pwd-confirm" className="text-sm text-[#0F0F0F]/70">Confirmer le nouveau mot de passe</Label>
              <Input
                id="pwd-confirm"
                type={showPwd ? "text" : "password"}
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
            >
              {showPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPwd ? "Masquer" : "Afficher"} les mots de passe
            </button>

            {pwdError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                {pwdSuccess}
              </div>
            )}

            <Button
              type="submit"
              disabled={isChangingPwd || !pwdNew || !pwdConfirm}
              className="bg-[#F2B33D] hover:bg-[#F2B33D]/90"
            >
              {isChangingPwd ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Mettre à jour le mot de passe
            </Button>
          </form>
        </section>
      </div>
      )}
    </div>
  )
}
