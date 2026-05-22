import { NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { getWalletBalances } from '@/lib/pawapay'

export const runtime = 'nodejs'

// In-memory cache to avoid hammering PawaPay on each admin refresh.
// Lives for the lifetime of the serverless instance.
let cache: { at: number; data: unknown } | null = null
const TTL_MS = 60_000

export async function GET() {
  const user = await checkAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ cached: true, ageMs: now - cache.at, ...(cache.data as object) })
  }

  try {
    const data = await getWalletBalances()
    cache = { at: now, data }
    return NextResponse.json({ cached: false, ageMs: 0, ...data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'PawaPay API error' },
      { status: 502 }
    )
  }
}
