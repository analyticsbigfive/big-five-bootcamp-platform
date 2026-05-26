"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { checkAdmin } from "@/lib/admin-auth"

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY required for admin operations')
    }
    return createClient(url, key)
}

export async function getUsers() {
    try {
        const supabase = getSupabaseAdmin()
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return { success: true, data: users }
    } catch (error) {
        return { success: false, error: "Failed to fetch users" }
    }
}

export async function getPayments() {
    try {
        const supabase = getSupabaseAdmin()
        const { data: payments, error } = await supabase
            .from('payments')
            .select('id, ref_command, amount, currency, payment_method, status, user_email, item_name, created_at, completed_at')
            .order('created_at', { ascending: false })

        if (error) throw error
        return { success: true, data: payments || [] }
    } catch (error) {
        return { success: false, data: [] }
    }
}

export async function toggleUserStatus(id: string, currentStatus: string) {
    try {
        const supabase = getSupabaseAdmin()
        const newStatus = currentStatus === "active" ? "inactive" : "active"
        const { error } = await supabase
            .from('users')
            .update({ status: newStatus })
            .eq('id', id)

        if (error) throw error
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to update user status" }
    }
}

export async function updateUserPlan(id: string, plan: string) {
    try {
        const supabase = getSupabaseAdmin()
        const updateData: Record<string, unknown> = { plan }

        // Si l'admin force un plan non payant (null / vide / legacy 'Free'),
        // marquer l'abonnement comme expiré — le user sera redirigé vers /subscribe.
        const lower = String(plan || '').toLowerCase()
        const isPaidPlan = lower === 'discovery' || lower === 'basic' || lower === 'pro'
        if (!isPaidPlan) {
            updateData.plan = null
            updateData.subscription_status = "expired"
        } else {
            updateData.subscription_status = "active"
        }

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)

        if (error) throw error
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Erreur lors de la mise à jour du plan" }
    }
}

export async function getFavoritesCounts() {
    try {
        const supabase = getSupabaseAdmin()
        // Récupérer tous les favoris groupés par user_id
        const { data: favorites, error } = await (supabase as any)
            .from('favorites')
            .select('user_id, campaign_id')

        if (error) throw error

        // Compter les favoris par utilisateur
        const countsByUser: Record<string, number> = {}
        for (const fav of (favorites || [])) {
            const uid = fav.user_id
            countsByUser[uid] = (countsByUser[uid] || 0) + 1
        }

        return { success: true, data: countsByUser }
    } catch (error) {
        console.error('Error fetching favorites counts:', error)
        return { success: true, data: {} }
    }
}

export async function endSubscription(userId: string) {
    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('users')
            .update({
                plan: null,
                subscription_status: 'expired',
                subscription_end_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

        if (error) throw error
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error('Error ending subscription:', error)
        return { success: false, error: "Failed to end subscription" }
    }
}

export async function resetSubscription(
    userId: string,
    days: number = 30,
    plan?: 'Discovery' | 'Basic' | 'Pro'
) {
    try {
        const supabase = getSupabaseAdmin()
        const now = new Date()
        const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

        // Pas d'upgrade silencieux vers Pro : si plan non specifie, on reprend
        // le plan actuel de l'utilisateur (par defaut "Basic" si jamais defini).
        let resolvedPlan: 'Discovery' | 'Basic' | 'Pro'
        if (plan) {
            resolvedPlan = plan
        } else {
            const { data: existing } = await supabase
                .from('users')
                .select('plan')
                .eq('id', userId)
                .single<{ plan: string | null }>()
            const current = String(existing?.plan || '').toLowerCase()
            resolvedPlan =
                current === 'pro' ? 'Pro'
                : current === 'basic' ? 'Basic'
                : current === 'discovery' ? 'Discovery'
                : 'Basic'
        }

        const { data: userRow, error: userErr } = await supabase
            .from('users')
            .update({
                plan: resolvedPlan,
                subscription_status: 'active',
                subscription_start_date: now.toISOString(),
                subscription_end_date: endDate.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', userId)
            .select('email')
            .single<{ email: string | null }>()

        if (userErr) throw userErr

        // Audit ligne payments : trace activation manuelle (montant=0).
        await (supabase as any)
            .from('payments')
            .insert({
                ref_command: `manual-${userId}-${now.getTime()}`,
                amount: 0,
                currency: 'XOF',
                status: 'completed',
                payment_method: 'manual_admin',
                user_email: userRow?.email || null,
                item_name: `Activation manuelle ${resolvedPlan} (${days}j)`,
                metadata: { type: 'manual_activation', userId, plan: resolvedPlan, days },
                created_at: now.toISOString(),
                completed_at: now.toISOString(),
            })

        revalidatePath("/admin/users")
        revalidatePath("/admin/payments")
        return { success: true }
    } catch (error) {
        console.error('Error resetting subscription:', error)
        return { success: false, error: "Failed to reset subscription" }
    }
}

export async function setUserRole(userId: string, role: 'admin' | 'user') {
    try {
        const supabase = getSupabaseAdmin()

        // Mettre à jour la table users
        const { error: dbError } = await supabase
            .from('users')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (dbError) throw dbError

        // Mettre à jour app_metadata dans Supabase Auth (utilisé pour le login admin)
        const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
            app_metadata: { role },
        })

        if (authError) throw authError

        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error('Error updating user role:', error)
        return { success: false, error: "Impossible de modifier le rôle" }
    }
}

/**
 * Réinitialise les compteurs mensuels (consultations + recherches/filtres)
 * d'un utilisateur précis.
 */
export async function resetUserViews(userId: string) {
    try {
        const supabase = getSupabaseAdmin()
        const now = new Date()
        // Premier du mois courant — format DATE valide (les colonnes sont de type DATE).
        const monthFirstDay = now.toISOString().slice(0, 7) + '-01'

        const { error } = await supabase
            .from('users')
            .update({
                daily_click_count: 0,
                daily_click_reset: monthFirstDay,
                daily_search_count: {},
                daily_search_reset: monthFirstDay,
                monthly_campaigns_explored: 0,
                monthly_click_count: 0,
                monthly_click_reset: now.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', userId)

        if (error) throw error
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error) {
        console.error('Error resetting user views:', error)
        return { success: false, error: "Impossible de réinitialiser les vues" }
    }
}

// ─── Bulk add users ──────────────────────────────────────────────────────────
// Crée (ou met à jour si déjà existant) une liste d'utilisateurs avec un plan
// + une durée d'abonnement. Conçu pour l'onboarding d'un bootcamp / cohorte.
//
// Format d'entrée : une liste d'objets { email, plan? }. Si `plan` absent, le
// `defaultPlan` est utilisé. La durée s'applique à tous les comptes traités.
// Un mot de passe par défaut est défini pour les comptes créés ; il peut être
// surchargé par l'admin via `defaultPassword`.

export type BulkUserPlan = 'Discovery' | 'Basic' | 'Pro'

export interface BulkUserInput {
    email: string
    plan?: BulkUserPlan | null
}

export interface BulkUserResult {
    email: string
    status: 'created' | 'updated' | 'error'
    plan?: BulkUserPlan
    userId?: string
    message?: string
}

function normalizePlan(raw: string | null | undefined): BulkUserPlan | null {
    const p = String(raw || '').trim().toLowerCase()
    if (p === 'pro') return 'Pro'
    if (p === 'basic') return 'Basic'
    if (p === 'discovery' || p === 'découverte' || p === 'decouverte') return 'Discovery'
    return null
}

function nameFromEmail(email: string): string {
    return email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function bulkCreateUsers(payload: {
    users: BulkUserInput[]
    defaultPlan: BulkUserPlan
    durationDays: number
    defaultPassword?: string
}): Promise<{
    success: boolean
    results?: BulkUserResult[]
    summary?: { created: number; updated: number; errors: number }
    error?: string
}> {
    try {
        const admin = await checkAdmin()
        if (!admin) {
            return { success: false, error: 'Accès refusé : admin requis' }
        }

        const days = Math.max(1, Math.min(3650, Math.floor(payload.durationDays || 30)))
        const password = (payload.defaultPassword || 'Dein@hoinra125').trim()
        if (password.length < 8) {
            return { success: false, error: 'Mot de passe par défaut trop court (min 8 caractères)' }
        }

        const seen = new Set<string>()
        const inputs: BulkUserInput[] = []
        for (const u of payload.users || []) {
            const email = String(u.email || '').trim().toLowerCase()
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
            if (seen.has(email)) continue
            seen.add(email)
            inputs.push({ email, plan: u.plan ?? payload.defaultPlan })
        }
        if (inputs.length === 0) {
            return { success: false, error: 'Aucun email valide fourni' }
        }

        const supabase = getSupabaseAdmin()
        const results: BulkUserResult[] = []
        const now = new Date()
        const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
        const subscriptionPatch = {
            subscription_status: 'active' as const,
            subscription_start_date: now.toISOString(),
            subscription_end_date: end.toISOString(),
            updated_at: now.toISOString(),
        }

        for (const u of inputs) {
            const plan = normalizePlan(u.plan) || payload.defaultPlan
            const name = nameFromEmail(u.email)

            try {
                // 1) Créer le compte Auth, ou récupérer l'existant.
                let userId: string | null = null
                let isNew = false

                const { data: created, error: createErr } =
                    await supabase.auth.admin.createUser({
                        email: u.email,
                        password,
                        email_confirm: true,
                        user_metadata: { name },
                    })

                if (createErr) {
                    const msg = createErr.message.toLowerCase()
                    if (msg.includes('already') || msg.includes('exist') || msg.includes('registered')) {
                        // Compte déjà créé : retrouver son id en paginant listUsers.
                        let page = 1
                        while (!userId) {
                            const { data: list, error: listErr } =
                                await supabase.auth.admin.listUsers({ page, perPage: 1000 })
                            if (listErr) throw listErr
                            const match = list.users.find(
                                (x) => x.email?.toLowerCase() === u.email.toLowerCase()
                            )
                            if (match) {
                                userId = match.id
                                break
                            }
                            if (list.users.length < 1000) break
                            page++
                        }
                        if (!userId) throw new Error('Compte existant introuvable via listUsers')
                    } else {
                        throw createErr
                    }
                } else {
                    userId = created.user.id
                    isNew = true
                }

                // 2) Upsert dans public.users avec plan + dates d'abonnement.
                // `is_beta_tester = true` marque les comptes créés par l'ajout
                // en masse (cohortes / bêta-testeurs invités par un admin).
                const { error: profileErr } = await supabase.from('users').upsert(
                    {
                        id: userId,
                        email: u.email,
                        name,
                        role: 'user',
                        status: 'active',
                        plan,
                        is_beta_tester: true,
                        ...subscriptionPatch,
                    },
                    { onConflict: 'id' }
                )
                if (profileErr) throw profileErr

                results.push({
                    email: u.email,
                    status: isNew ? 'created' : 'updated',
                    plan,
                    userId: userId!,
                })
            } catch (e: any) {
                results.push({
                    email: u.email,
                    status: 'error',
                    message: e?.message || String(e),
                })
            }
        }

        const summary = {
            created: results.filter((r) => r.status === 'created').length,
            updated: results.filter((r) => r.status === 'updated').length,
            errors: results.filter((r) => r.status === 'error').length,
        }

        revalidatePath('/admin/users')
        return { success: true, results, summary }
    } catch (error: any) {
        console.error('bulkCreateUsers error:', error)
        return { success: false, error: error?.message || 'Erreur inconnue' }
    }
}
