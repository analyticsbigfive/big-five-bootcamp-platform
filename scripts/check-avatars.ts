import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) config({ path: envLocalPath })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  console.log('=== auth.users avec avatar dans user_metadata ===')
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const withAvatar = (authData?.users || []).filter((u: any) =>
    u.user_metadata?.avatar_url || u.user_metadata?.picture
  )
  console.log(`${withAvatar.length} user(s) avec avatar (user_metadata)`)
  for (const u of withAvatar.slice(0, 10)) {
    const url = u.user_metadata?.avatar_url || u.user_metadata?.picture
    console.log(`  ${u.email}  →  ${url}`)
  }

  console.log('\n=== public.users : columns disponibles ===')
  const { data: sample } = await (supabase as any).from('users').select('*').limit(1)
  if (sample && sample[0]) console.log('Colonnes:', Object.keys(sample[0]).join(', '))
}
main().catch((e) => { console.error(e); process.exit(1) })
