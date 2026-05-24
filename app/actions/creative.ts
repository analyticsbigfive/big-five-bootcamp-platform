"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { generateSlug, getGoogleDriveImageUrl } from "@/lib/utils"
import { getViewerAccess, redactPremiumFields, redactPremiumFieldsList } from "@/lib/content-access"

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY required for admin operations')
    }
    return createClient(url, key)
}

// Colonnes nécessaires pour la liste admin (vue compacte)
const CREATIVE_LIST_COLUMNS = 'id, title, slug, brand, category, status, thumbnail, platforms, created_at, featured, access_level'

// Colonnes complètes pour la vue détail
const CREATIVE_DETAIL_COLUMNS = 'id, title, slug, summary, description, thumbnail, platforms, country, category, format, tags, created_at, video_url, images, brand, agency, year, axe, analyse, how_to_use, status, access_level, featured, publication_url, campaign_date, temps_fort_slugs'

// Colonnes nécessaires au dashboard (liste enrichie côté connecté)
const DASHBOARD_COLUMNS = 'id, title, summary, description, thumbnail, platforms, country, category, format, tags, created_at, video_url, images, brand, agency, year, axe, analyse, how_to_use, status, access_level, featured, publication_url, temps_fort_slugs'

export async function getCreatives() {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('campaigns')
            .select(CREATIVE_LIST_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(500)

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        return { success: false, error: "Failed to fetch creatives" }
    }
}

export async function getCreativeById(id: string) {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('campaigns')
            .select(CREATIVE_DETAIL_COLUMNS)
            .eq('id', id)
            .single()

        if (error) throw error
        return { success: true, data }
    } catch (error) {
        return { success: false, error: "Failed to fetch creative" }
    }
}

export async function getCreativeByIdOrSlug(idOrSlug: string) {
    try {
        const supabase = getSupabaseAdmin()
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)

        const { data, error } = await supabase
            .from('campaigns')
            .select(CREATIVE_DETAIL_COLUMNS)
            .eq(isUUID ? 'id' : 'slug', idOrSlug)
            .single()

        if (error) throw error

        // Filtrage premium côté serveur : un compte gratuit (ou anonyme) ne doit
        // jamais recevoir analyse/how_to_use d'une campagne premium dans le payload.
        const viewer = await getViewerAccess()
        return { success: true, data: redactPremiumFields(data, viewer) }
    } catch (error) {
        return { success: false, error: "Failed to fetch creative" }
    }
}

// Récupère des campagnes par IDs (collections/favoris), avec filtrage premium
// serveur. Remplace le `select('*')` client direct de la page favoris, qui
// exposait analyse/how_to_use au JWT et casserait après le revoke colonne.
export async function getCampaignsByIds(ids: string[]) {
    try {
        if (!ids || ids.length === 0) return { success: true, data: [] }
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .in('id', ids)

        if (error) throw error

        const viewer = await getViewerAccess()
        return { success: true, data: redactPremiumFieldsList(data || [], viewer) }
    } catch (error) {
        return { success: false, error: "Failed to fetch campaigns" }
    }
}

// Liste des campagnes publiées pour le dashboard, avec filtrage premium serveur.
// Remplace la requête Supabase directe côté client (qui exposait analyse/how_to_use
// dans la réponse réseau à tout compte connecté, quel que soit son plan).
export async function getDashboardCampaigns() {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('campaigns')
            .select(DASHBOARD_COLUMNS)
            .eq('status', 'Publié')
            .order('created_at', { ascending: false })
            .limit(500)

        if (error) throw error

        const viewer = await getViewerAccess()
        return { success: true, data: redactPremiumFieldsList(data || [], viewer) }
    } catch (error) {
        return { success: false, error: "Failed to fetch dashboard campaigns" }
    }
}

export async function createCreative(formData: FormData) {
    const title = formData.get("title") as string
    const platform = formData.get("platform") as string
    const format = formData.get("format") as string
    const sector = formData.get("sector") as string
    const objective = formData.get("objective") as string
    const thumbnail = formData.get("thumbnail") as string
    const videoUrl = formData.get("videoUrl") as string
    const campaignDate = formData.get("campaignDate") as string
    const description = formData.get("description") as string
    const analyse = formData.get("analyse") as string
    const brand = formData.get("brand") as string
    const country = formData.get("country") as string
    const agency = formData.get("agency") as string
    const year = formData.get("year") as string

    try {
        const supabase = getSupabaseAdmin()
        
        // Générer le slug avec vérification d'unicité
        let slug = generateSlug(title)
        let slugCounter = 2
        while (true) {
            const { data: existing } = await supabase
                .from('campaigns')
                .select('id')
                .eq('slug', slug)
                .maybeSingle()
            if (!existing) break
            slug = `${generateSlug(title)}-${slugCounter}`
            slugCounter++
        }
        
        const { error } = await supabase.from('campaigns').insert({
            title,
            slug,
            category: sector,
            platforms: [platform],
            thumbnail,
            video_url: videoUrl || null,
            campaign_date: campaignDate || null,
            description: description || null,
            analyse: analyse || null,
            tags: [format, objective].filter(Boolean),
            status: 'Publié',
            brand: brand || null,
            country: country || null,
            agency: agency || null,
            year: year ? parseInt(year) : null,
            format: format || null,
        })

        if (error) throw error
        revalidatePath("/admin/creatives")
        revalidatePath("/library")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false, error: "Failed to create creative" }
    }
}

export async function updateCreative(id: string, formData: FormData) {
    const title = formData.get("title") as string
    const platform = formData.get("platform") as string
    const format = formData.get("format") as string
    const sector = formData.get("sector") as string
    const objective = formData.get("objective") as string
    const thumbnail = formData.get("thumbnail") as string
    const videoUrl = formData.get("videoUrl") as string
    const campaignDate = formData.get("campaignDate") as string
    const description = formData.get("description") as string
    const analyse = formData.get("analyse") as string
    const brand = formData.get("brand") as string
    const country = formData.get("country") as string
    const agency = formData.get("agency") as string
    const year = formData.get("year") as string

    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('campaigns')
            .update({
                title,
                category: sector,
                platforms: [platform],
                thumbnail,
                video_url: videoUrl || null,
                campaign_date: campaignDate || null,
                description: description || null,
                analyse: analyse || null,
                tags: [format, objective].filter(Boolean),
                brand: brand || null,
                country: country || null,
                agency: agency || null,
                year: year ? parseInt(year) : null,
                format: format || null,
            })
            .eq('id', id)

        if (error) throw error
        revalidatePath("/admin/creatives")
        revalidatePath("/library")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to update creative" }
    }
}

export async function deleteCreative(id: string) {
    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath("/admin/creatives")
        revalidatePath("/library")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to delete creative" }
    }
}

export async function getRelatedCampaigns(campaignId: string, tags: string[] | null, category: string | null, brand: string | null) {
    try {
        const supabase = getSupabaseAdmin()
        let related: any[] = []

        // 1. Par tags communs
        if (tags && tags.length > 0) {
            const { data } = await supabase
                .from('campaigns')
                .select(CREATIVE_LIST_COLUMNS)
                .neq('id', campaignId)
                .eq('status', 'Publié')
                .overlaps('tags', tags)
                .limit(8)
            if (data) related = data
        }

        // 2. Compléter par catégorie
        if (related.length < 8 && category) {
            const existingIds = [campaignId, ...related.map(r => r.id)]
            const { data } = await supabase
                .from('campaigns')
                .select(CREATIVE_LIST_COLUMNS)
                .not('id', 'in', `(${existingIds.join(',')})`)
                .eq('status', 'Publié')
                .eq('category', category)
                .limit(8 - related.length)
            if (data) related = [...related, ...data]
        }

        // 3. Compléter par marque
        if (related.length < 8 && brand) {
            const existingIds = [campaignId, ...related.map(r => r.id)]
            const { data } = await supabase
                .from('campaigns')
                .select(CREATIVE_LIST_COLUMNS)
                .not('id', 'in', `(${existingIds.join(',')})`)
                .eq('status', 'Publié')
                .eq('brand', brand)
                .limit(8 - related.length)
            if (data) related = [...related, ...data]
        }

        // 4. Compléter avec des récentes
        if (related.length < 8) {
            const existingIds = [campaignId, ...related.map(r => r.id)]
            const { data } = await supabase
                .from('campaigns')
                .select(CREATIVE_LIST_COLUMNS)
                .not('id', 'in', `(${existingIds.join(',')})`)
                .eq('status', 'Publié')
                .order('created_at', { ascending: false })
                .limit(8 - related.length)
            if (data) related = [...related, ...data]
        }

        return { success: true, data: related }
    } catch (error) {
        return { success: false, data: [], error: "Failed to fetch related campaigns" }
    }
}

interface CSVCreativeRow {
    title: string
    brand?: string
    agency?: string
    platform?: string
    country?: string
    sector?: string
    format?: string
    year?: string
    imageUrl?: string
    videoUrl?: string
    analyse?: string
    how_to_use?: string
    summary?: string
    description?: string
    tags?: string
    status?: string
    accessLevel?: string
    axe?: string
    featured?: string
    publication_url?: string
}

const VALID_STATUSES = ['Brouillon', 'En attente', 'Publié']
const VALID_ACCESS_LEVELS = ['free', 'premium']

export async function importCreativesFromCSV(rows: CSVCreativeRow[]) {
    const supabase = getSupabaseAdmin()
    const errors: string[] = []
    let imported = 0
    const usedSlugs = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        try {
            const titleTrimmed = row.title.trim()
            const brandTrimmed = (row.brand || '').trim()

            // Parse tags separated by ;
            const tags = row.tags
                ? row.tags.split(';').map(t => t.trim()).filter(Boolean)
                : []

            // Validate and normalize status
            const status = VALID_STATUSES.includes(row.status?.trim() || '')
                ? row.status!.trim()
                : 'Brouillon'

            // Validate and normalize accessLevel
            const accessLevel = VALID_ACCESS_LEVELS.includes(row.accessLevel?.trim().toLowerCase() || '')
                ? row.accessLevel!.trim().toLowerCase()
                : 'free'

            // Parse year as number
            const year = row.year ? parseInt(row.year, 10) : null

            // Convert Google Drive URLs to direct image URLs
            const thumbnail = row.imageUrl?.trim()
                ? getGoogleDriveImageUrl(row.imageUrl.trim())
                : null
            const videoUrl = row.videoUrl?.trim()
                ? getGoogleDriveImageUrl(row.videoUrl.trim())
                : null

            // Generate unique slug (check both DB and current batch)
            let slug = generateSlug(titleTrimmed)
            let slugCounter = 2
            while (true) {
                if (usedSlugs.has(slug)) {
                    slug = `${generateSlug(titleTrimmed)}-${slugCounter}`
                    slugCounter++
                    continue
                }
                const { data: existing } = await supabase
                    .from('campaigns')
                    .select('id')
                    .eq('slug', slug)
                    .maybeSingle()
                if (!existing) break
                slug = `${generateSlug(titleTrimmed)}-${slugCounter}`
                slugCounter++
            }
            usedSlugs.add(slug)

            // Mapping CSV → colonnes DB :
            // CSV "description" → DB "description" (description de la campagne)
            // CSV "analyse" → DB "analyse" (analyse stratégique)
            // CSV "how_to_use" → DB "how_to_use" (Comment s'en servir)
            // CSV "summary" → DB "summary" (Résumé court)
            // CSV "sector" → DB "category"
            // CSV "imageUrl" → DB "thumbnail"
            // CSV "videoUrl" → DB "video_url"
            // CSV "platform" → DB "platforms" (array)
            // CSV "accessLevel" → DB "access_level"
            // CSV "featured" → DB "featured" (boolean)

            const { error } = await supabase.from('campaigns').insert({
                title: titleTrimmed,
                slug,
                brand: brandTrimmed || null,
                agency: row.agency?.trim() || null,
                platforms: row.platform ? [row.platform.trim()] : [],
                country: row.country?.trim() || null,
                category: row.sector?.trim() || null,
                format: row.format?.trim() || null,
                year: (year && !isNaN(year)) ? year : null,
                thumbnail,
                video_url: videoUrl,
                description: row.description?.trim() || null,
                summary: row.summary?.trim() || null,
                analyse: row.analyse?.trim() || null,
                how_to_use: row.how_to_use?.trim() || null,
                tags,
                status,
                access_level: accessLevel,
                axe: row.axe
                    ? row.axe.split(';').map(a => a.trim()).filter(Boolean)
                    : [],
                featured: row.featured?.trim().toLowerCase() === 'true' ? true : false,
                publication_url: row.publication_url?.trim() || null,
            })

            if (error) {
                errors.push(`Ligne ${i + 1}: ${error.message}`)
            } else {
                imported++
            }
        } catch (error: any) {
            errors.push(`Ligne ${i + 1}: ${error.message || 'Erreur inconnue'}`)
        }
    }

    revalidatePath("/admin/creatives")
    revalidatePath("/admin/campaigns")
    revalidatePath("/library")
    revalidatePath("/dashboard")

    if (errors.length > 0) {
        return {
            success: imported > 0,
            imported,
            errors,
            error: `${errors.length} erreur(s) sur ${rows.length} lignes`
        }
    }

    return { success: true, imported }
}
