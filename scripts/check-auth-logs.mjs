import pg from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL manquante dans .env.local')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: databaseUrl,
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
