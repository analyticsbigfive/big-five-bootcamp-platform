import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.prod", quiet: true });

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const columns = await client.query(`
    select table_schema, table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'auth'
      and table_name in ('audit_log_entries', 'sessions', 'refresh_tokens', 'users')
    order by table_name, ordinal_position
  `);

  const auditRecent = await client.query(`
    select
      now() as db_now,
      count(*)::int as total,
      min(created_at) as first_seen,
      max(created_at) as last_seen
    from auth.audit_log_entries
    where created_at >= now() - interval '15 minutes'
  `);

  const auditSamples = await client.query(`
    select id, created_at, ip_address, payload
    from auth.audit_log_entries
    where created_at >= now() - interval '15 minutes'
    order by created_at desc
    limit 50
  `);

  console.log(JSON.stringify({
    columns: columns.rows,
    auditRecent: auditRecent.rows[0],
    auditSamples: auditSamples.rows,
  }, null, 2));
} finally {
  await client.end().catch(() => {});
}
