/**
 * Gmail API sender via JWT OAuth2 (Service Account + Domain-Wide Delegation).
 *
 * Cloudflare Workers compatible (Web Crypto API, no Node.js TCP socket).
 * Replaces Resend for all transactional email sending.
 *
 * Setup required:
 * - Service Account in Google Cloud with Gmail API enabled.
 * - Domain-Wide Delegation authorized in Workspace Admin with scope
 *   `https://www.googleapis.com/auth/gmail.send`.
 * - Env vars: GMAIL_CLIENT_EMAIL, GMAIL_PRIVATE_KEY,
 *   GMAIL_IMPERSONATE_USER, GMAIL_FROM.
 */

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/gmail.send'

type Recipient = string | string[]

export interface SendMailOptions {
  to: Recipient
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  cc?: Recipient
  bcc?: Recipient
}

export interface SendMailResult {
  ok: boolean
  id?: string
  error?: string
}

function base64UrlEncode(input: string | ArrayBuffer | Uint8Array): string {
  let bytes: Uint8Array
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input)
  } else {
    bytes = input
  }
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token
  }

  const clientEmail = process.env.GMAIL_CLIENT_EMAIL
  const rawKey = process.env.GMAIL_PRIVATE_KEY
  const impersonate = process.env.GMAIL_IMPERSONATE_USER

  if (!clientEmail || !rawKey || !impersonate) {
    throw new Error('Gmail credentials missing (GMAIL_CLIENT_EMAIL / GMAIL_PRIVATE_KEY / GMAIL_IMPERSONATE_USER)')
  }

  const privateKeyPem = rawKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: clientEmail,
    sub: impersonate,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const claimsB64 = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${headerB64}.${claimsB64}`

  const keyBuffer = pemToArrayBuffer(privateKeyPem)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gmail token exchange failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

function normalizeRecipients(value: Recipient | undefined): string {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function buildRfc2822(opts: SendMailOptions): string {
  const from = opts.from || process.env.GMAIL_FROM || `Laveiye <${process.env.GMAIL_IMPERSONATE_USER}>`
  const to = normalizeRecipients(opts.to)
  const cc = normalizeRecipients(opts.cc)
  const bcc = normalizeRecipients(opts.bcc)

  const boundary = `laveiye_${Math.random().toString(36).slice(2)}`
  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : '',
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`,
    'MIME-Version: 1.0',
  ].filter(Boolean)

  if (opts.html && opts.text) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    const body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.html,
      '',
      `--${boundary}--`,
    ].join('\r\n')
    return headers.join('\r\n') + body
  }

  if (opts.html) {
    headers.push('Content-Type: text/html; charset=UTF-8')
    return headers.join('\r\n') + '\r\n\r\n' + opts.html
  }

  headers.push('Content-Type: text/plain; charset=UTF-8')
  return headers.join('\r\n') + '\r\n\r\n' + (opts.text || '')
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  try {
    const token = await getAccessToken()
    const rfc2822 = buildRfc2822(opts)
    const raw = base64UrlEncode(rfc2822)

    const response = await fetch(GMAIL_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[gmail-sender] send failed:', response.status, errorText)
      return { ok: false, error: `Gmail API ${response.status}: ${errorText.slice(0, 200)}` }
    }

    const data = (await response.json()) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[gmail-sender] unexpected error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
