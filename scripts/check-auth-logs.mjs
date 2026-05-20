import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const client = new pg.Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.jyycgendzegiazltvarx',
  password: 'fu.6uVa8%G-cStZ',
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const res = await client.query(`
  SELECT
    created_at,
    ip_address,
    payload->>'actor_username' AS user_email,
    payload->>'action' AS action,
    payload->'traits' AS traits
  FROM auth.audit_log_entries
  WHERE created_at > NOW() - INTERVAL '15 minutes'
  ORDER BY created_at DESC
  LIMIT 100;
`)

console.log(`Total entries last 15min: ${res.rows.length}`)
console.log(JSON.stringify(res.rows, null, 2))

await client.end()
