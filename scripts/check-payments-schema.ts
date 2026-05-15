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
  const { data } = await (supabase as any).from('payments').select('*').limit(1)
  if (data && data[0]) console.log('payments columns:', Object.keys(data[0]).join(', '))
  else console.log('payments empty or no read access')
}
main().catch((e) => { console.error(e); process.exit(1) })
