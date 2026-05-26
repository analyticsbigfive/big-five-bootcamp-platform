import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-auth'
import { resendDepositCallback } from '@/lib/pawapay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await checkAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { depositId } = await request.json()
  if (!depositId || typeof depositId !== 'string') {
    return NextResponse.json({ error: 'depositId requis' }, { status: 400 })
  }

  try {
    await resendDepositCallback(depositId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'PawaPay resend error' },
      { status: 502 }
    )
  }
}
