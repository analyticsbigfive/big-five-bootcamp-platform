"use client"

/**
 * Garde-fou d'abonnement pour les pages "premium-only".
 *
 * Tant que l'utilisateur n'a pas choisi de formule payante (Discovery / Basic / Pro),
 * on N'AFFICHE PAS le contenu enfant — un écran de chargement est rendu, puis
 * un redirect vers /subscribe?required=1 est déclenché par le hook.
 *
 * Pages où ce guard NE doit PAS être placé :
 *   - /dashboard/brand-requests (envoi de devis autorisé pour tous)
 *   - /profile, /settings (gestion du compte / abonnement)
 *   - /subscribe, /pay, /payment, /paywall, /pricing
 *   - /login, /register, /forgot-password, /update-password, /auth/*
 *   - pages légales / publiques (about, contact, terms, privacy)
 */

import { useRequireActiveSubscription } from "@/hooks/use-require-active-subscription"

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const { checking, locked } = useRequireActiveSubscription()

    if (checking || locked) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-white to-[#F5F5F5]/20">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F2B33D] border-t-transparent" />
                    <p className="text-sm text-[#0F0F0F]/70">
                        {locked ? "On prépare votre accès Laveiye…" : "Chargement…"}
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
