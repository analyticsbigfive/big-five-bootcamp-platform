import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'shoo'

// Vérifier que l'utilisateur est authentifié
async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Créer le bucket s'il n'existe pas
async function ensureBucketExists(supabaseAdmin: any) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET_NAME)
  
  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'application/pdf',
      ],
    })
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating bucket:', error)
      throw error
    }
  }
}

/**
 * POST /api/upload
 * Upload une image vers Supabase Storage
 * Body: multipart/form-data avec champ "file"
 * Returns: { url: string } — URL publique de l'image
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Lire le fichier depuis le FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Vérifier le type MIME (images + PDF)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
      'application/pdf',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Type de fichier non supporté: ${file.type}. Types acceptés: JPG, PNG, WebP, GIF, SVG, PDF`
      }, { status: 400 })
    }

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le fichier est trop volumineux (max 10 MB)' }, { status: 400 })
    }

    // Créer le client admin pour l'upload
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!adminUrl || !adminKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }
    const supabaseAdmin = createClient(adminUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // S'assurer que le bucket existe
    await ensureBucketExists(supabaseAdmin)

    // Générer un nom de fichier unique
    const isPdf = file.type === 'application/pdf'
    const ext = file.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${randomSuffix}.${ext}`
    // PDFs vont dans documents/, images dans thumbnails/
    const filePath = isPdf ? `documents/${fileName}` : `thumbnails/${fileName}`

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload vers Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: `Erreur d'upload: ${error.message}` }, { status: 500 })
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return NextResponse.json({ 
      url: publicUrl,
      path: data.path,
      fileName: fileName,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
