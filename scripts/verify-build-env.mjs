const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const missing = required.filter((name) => {
  const value = process.env[name]
  return !value || !String(value).trim()
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
const appUrlInvalid =
  process.env.NODE_ENV === 'production' &&
  (!!appUrl && (!/^https:\/\//i.test(appUrl) || /localhost|127\.0\.0\.1/i.test(appUrl)))

console.log('[verify-build-env] NODE_ENV=', process.env.NODE_ENV || '(unset)')
for (const name of required) {
  const value = process.env[name]
  const status = value ? `ok (len=${String(value).length})` : 'missing'
  console.log(`[verify-build-env] ${name}: ${status}`)
}

if (appUrl) {
  console.log(`[verify-build-env] NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL: ${appUrl}`)
}

if (missing.length > 0) {
  console.error(
    '[verify-build-env] Missing build env vars: ' +
      missing.join(', ') +
      '. Configure them in Cloudflare Pages > Settings > Environment variables for the target environment (Production/Preview), and make sure they are available during the BUILD step.'
  )
  process.exit(1)
}

if (appUrlInvalid) {
  console.error(
    '[verify-build-env] NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SITE_URL) is invalid for production. Use a public HTTPS URL (no localhost).'
  )
  process.exit(1)
}

console.log('[verify-build-env] OK')
