import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')
if (existsSync(envLocalPath)) config({ path: envLocalPath })
else if (existsSync(envPath)) config({ path: envPath })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const frag = (process.argv[2] || '').toLowerCase()

async function main() {
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authMatches = (authList?.users || []).filter(u => (u.email || '').toLowerCase().includes(frag))
  console.log(`auth.users (${authMatches.length}):`)
  for (const u of authMatches) console.log(`  ${u.email}  id=${u.id}`)

  const { data: profileMatches } = await (supabase as any)
    .from('users').select('id, email, plan, subscription_status').ilike('email', `%${frag}%`)
  console.log(`\npublic.users (${(profileMatches || []).length}):`)
  for (const u of (profileMatches || [])) console.log(`  ${u.email}  id=${u.id}  plan=${u.plan} status=${u.subscription_status}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
