export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const hasSupabaseEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!hasSupabaseEnv) {
      return NextResponse.json(
        { users: 0, campaigns: 0, brands: 0, countries: 0 },
        { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
      )
    }

    const [
      { count: usersCount, error: usersError },
      { count: campaignsCount, error: campaignsError },
      { data: brandsData, error: brandsError },
      { data: countriesData, error: countriesError },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'Publié'),
      supabase.from('campaigns').select('brand').eq('status', 'Publié').not('brand', 'is', null),
      supabase.from('campaigns').select('country').eq('status', 'Publié').not('country', 'is', null),
    ])

    if (usersError) console.error('Erreur comptage utilisateurs:', usersError)
    if (campaignsError) console.error('Erreur comptage campagnes:', campaignsError)
    if (brandsError) console.error('Erreur comptage marques:', brandsError)
    if (countriesError) console.error('Erreur comptage pays:', countriesError)

    const uniqueBrands = brandsData
      ? new Set(brandsData.map((c: any) => c.brand).filter(Boolean)).size
      : 0
    const uniqueCountries = countriesData
      ? new Set(countriesData.map((c: any) => c.country).filter(Boolean)).size
      : 0

    return NextResponse.json(
      { users: usersCount ?? 0, campaigns: campaignsCount ?? 0, brands: uniqueBrands, countries: uniqueCountries },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('Erreur API stats:', error)
    return NextResponse.json(
      { users: 0, campaigns: 0, brands: 0, countries: 0 },
      { status: 500 }
    )
  }
}
