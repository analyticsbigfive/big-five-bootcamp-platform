"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

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

        const { error } = await supabase
            .from('users')
            .update({
                plan: resolvedPlan,
                subscription_status: 'active',
                subscription_start_date: now.toISOString(),
                subscription_end_date: endDate.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', userId)

        if (error) throw error
        revalidatePath("/admin/users")
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
