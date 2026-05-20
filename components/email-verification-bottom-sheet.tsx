"use client"

/**
 * Bottom sheet affiché lorsqu'un utilisateur connecté n'a pas encore confirmé
 * son adresse email (user.email_confirmed_at == null). Affiche également un
 * toast d'avertissement la première fois de la session.
 *
 * UX :
 *   - Toast sonner non bloquant à l'apparition de l'état non confirmé.
 *   - Bottom sheet persistant (re-affiché si dismissé puis nouvelle navigation).
 *   - Bouton "Renvoyer l'email" → POST /api/auth/resend-confirmation.
 *   - Bouton "OK, j'ai vérifié" → ferme le sheet (mémoire localStorage 30 min).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { MailCheck, MailWarning, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuthContext } from "@/components/auth-provider"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "laveiye-email-confirmation-dismissed-until"
const DISMISS_TTL_MS = 30 * 60 * 1000 // 30 min
const HIDDEN_PATHS = ["/login", "/register", "/forgot-password", "/update-password"]

function isDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (!Number.isFinite(until)) return false
    if (until < Date.now()) {
      window.localStorage.removeItem(DISMISS_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS))
  } catch {
    // ignore
  }
}

export function EmailVerificationBottomSheet() {
  const { user, loading } = useAuthContext()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [resending, setResending] = useState(false)
  const toastShownRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // user.email_confirmed_at est défini quand Supabase a validé l'email.
  const emailConfirmed = !!(user as any)?.email_confirmed_at
  const needsConfirmation = !!user && !loading && !emailConfirmed
  const hiddenOnRoute = HIDDEN_PATHS.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    if (!mounted) return
    if (!needsConfirmation || hiddenOnRoute) {
      setVisible(false)
      const t = window.setTimeout(() => setOpen(false), 200)
      return () => window.clearTimeout(t)
    }
    if (isDismissed()) return

    // Toast une seule fois par cycle de vie du provider.
    if (!toastShownRef.current) {
      toastShownRef.current = true
      toast.warning("Vérifie ton adresse email", {
        description:
          "Nous t'avons envoyé un lien de confirmation. Clique dessus pour activer ton compte.",
        duration: 7000,
        icon: <MailWarning className="h-4 w-4" />,
      })
    }

    setOpen(true)
    requestAnimationFrame(() => setVisible(true))
  }, [mounted, needsConfirmation, hiddenOnRoute])

  const closeSheet = useCallback(() => {
    markDismissed()
    setVisible(false)
    window.setTimeout(() => setOpen(false), 220)
  }, [])

  const handleResend = useCallback(async () => {
    if (!user?.email || resending) return
    setResending(true)
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      if (res.ok) {
        toast.success("Email renvoyé", {
          description: `Vérifie ta boîte ${user.email} (et les spams).`,
          icon: <MailCheck className="h-4 w-4" />,
        })
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error("Impossible de renvoyer l'email", {
          description: data.error || "Réessaie dans quelques minutes.",
        })
      }
    } catch {
      toast.error("Erreur réseau", { description: "Vérifie ta connexion." })
    } finally {
      setResending(false)
    }
  }, [user?.email, resending])

  if (!mounted || !open || !needsConfirmation || hiddenOnRoute) return null

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[110] flex justify-center px-3 pb-3 sm:px-6 sm:pb-5 pointer-events-none",
      )}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="email-verification-sheet-title"
        className={cn(
          "pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#F5F5F5] bg-white shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
      >
        <div className="relative grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-7">
          <button
            type="button"
            aria-label="Fermer"
            onClick={closeSheet}
            className="absolute right-3 top-3 rounded-full p-1.5 text-[#0F0F0F]/40 transition-colors hover:bg-[#F5F5F5] hover:text-[#0F0F0F]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F2B33D]/10 sm:flex">
              <MailWarning className="h-6 w-6 text-[#F2B33D]" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F2B33D]/10 px-3 py-1 text-xs font-bold uppercase text-[#0F0F0F] ring-1 ring-[#F2B33D]/20">
                <MailWarning className="h-3.5 w-3.5 text-[#F2B33D]" />
                Email à confirmer
              </div>
              <h2
                id="email-verification-sheet-title"
                className="font-[family-name:var(--font-heading)] text-lg font-extrabold leading-tight text-[#0F0F0F] sm:text-xl"
              >
                Vérifie ta boîte mail
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#0F0F0F]/70">
                Un email de confirmation a été envoyé à{" "}
                <span className="font-semibold text-[#0F0F0F]">{user?.email}</span>. Clique sur le
                lien pour activer ton compte. Pense à regarder dans les spams.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="h-10 rounded-lg bg-[#F2B33D] text-sm font-bold text-white shadow-lg shadow-[#F2B33D]/20 hover:bg-[#F2B33D]/90"
            >
              <RefreshCw className={cn("h-4 w-4", resending && "animate-spin")} />
              {resending ? "Envoi…" : "Renvoyer l'email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeSheet}
              className="h-10 rounded-lg text-sm font-bold text-[#0F0F0F]/65 hover:bg-[#F5F5F5] hover:text-[#0F0F0F]"
            >
              J'ai vérifié, plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
