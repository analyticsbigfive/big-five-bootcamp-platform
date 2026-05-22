/**
 * Client PawaPay — Merchant API v2
 *
 * Documentation officielle :
 *   https://docs.pawapay.io/v2/docs/what_to_know
 *
 * Ce module fournit :
 *   - La configuration (base URL, token, environnement)
 *   - Les helpers pour initier deposits / payouts / refunds
 *   - Les helpers pour vérifier le statut (polling de secours)
 *   - La liste des IPs autorisées pour les callbacks (IP whitelist)
 *   - Les types TypeScript des payloads de callback
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Environnement PawaPay — `sandbox` pour les tests, `production` pour la prod.
 * Se configure via PAWAPAY_ENV (défaut: sandbox).
 */
export type PawaPayEnv = 'sandbox' | 'production'

export const PAWAPAY_ENV: PawaPayEnv =
  (process.env.PAWAPAY_ENV as PawaPayEnv) || 'sandbox'

export const PAWAPAY_BASE_URL =
  PAWAPAY_ENV === 'production'
    ? 'https://api.pawapay.io'
    : 'https://api.sandbox.pawapay.io'

export const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN || ''

/**
 * URL publique de notre application (utilisée pour construire les callback URLs
 * côté Dashboard PawaPay et les successful/failed URLs).
 *
 * Doit être en HTTPS en production.
 */
function resolvePublicBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://laveiye.com'
      : 'http://localhost:3000')

  if (process.env.NODE_ENV === 'production') {
    if (/localhost|127\.0\.0\.1/i.test(raw) || !/^https:\/\//i.test(raw)) {
      console.warn(
        `NEXT_PUBLIC_APP_URL invalide en production : "${raw}". ` +
          `Définir une URL HTTPS publique (sans localhost).`
      )
    }
  }
  return raw
}

export const PUBLIC_BASE_URL = resolvePublicBaseUrl()

/**
 * URLs publiques de callback à déclarer dans le Dashboard PawaPay.
 *
 * À configurer ici : https://docs.pawapay.io/dashboard/other/system_conf/callback_urls
 */
export const PAWAPAY_CALLBACK_URLS = {
  deposit: `${PUBLIC_BASE_URL}/api/payment/pawapay/callback/deposit`,
  payout: `${PUBLIC_BASE_URL}/api/payment/pawapay/callback/payout`,
  refund: `${PUBLIC_BASE_URL}/api/payment/pawapay/callback/refund`,
} as const

/**
 * IPs sources des callbacks PawaPay (à whitelister si nécessaire).
 * Source : https://docs.pawapay.io/v2/docs/what_to_know#ips-to-whitelist
 */
export const PAWAPAY_ALLOWED_IPS = {
  sandbox: ['3.64.89.224'],
  production: [
    '18.192.208.15',
    '18.195.113.136',
    '3.72.212.107',
    '54.73.125.42',
    '54.155.38.214',
    '54.73.130.113',
  ],
} as const

/**
 * Vérifie que la requête provient bien d'une IP PawaPay.
 *
 * Next.js sur Vercel place l'IP réelle dans `x-forwarded-for`.
 * Si la variable PAWAPAY_VERIFY_IP n'est pas activée, on laisse passer
 * (utile en local et pour tester).
 */
export function isAllowedPawaPayIP(request: Request): boolean {
  const isProd = process.env.NODE_ENV === 'production'
  const verifyFlag = process.env.PAWAPAY_VERIFY_IP === 'true'

  // Production: vérification IP toujours active, pas de bypass.
  // Dev/test: vérifier uniquement si PAWAPAY_VERIFY_IP=true.
  const shouldVerify = isProd || verifyFlag

  if (!shouldVerify) return true

  // Cloudflare: vraie IP source dans `cf-connecting-ip`. Fallback `x-forwarded-for`
  // pour Vercel/Node. `x-real-ip` en backup.
  const cfIp = request.headers.get('cf-connecting-ip') || ''
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  const ip = cfIp || forwarded.split(',')[0]?.trim() || realIp || ''

  const allowed: string[] = [
    ...PAWAPAY_ALLOWED_IPS.sandbox,
    ...PAWAPAY_ALLOWED_IPS.production,
  ]
  return allowed.includes(ip)
}

// ============================================================================
// Types — payloads des callbacks
// ============================================================================

export type PawaPayStatus =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ENQUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_RECONCILIATION'
  | 'DUPLICATE_IGNORED'

export interface PawaPayFailureReason {
  failureCode: string
  failureMessage: string
}

export interface PawaPayMmoAccount {
  type: 'MMO'
  accountDetails: {
    phoneNumber: string
    provider: string // ex. MTN_MOMO_BEN, ORANGE_CIV, FREE_SEN... (Wave NON supporté par PawaPay)
  }
}

/** Payload du callback `deposit`. */
export interface PawaPayDepositCallback {
  depositId: string
  status: PawaPayStatus
  amount?: string
  currency?: string
  country?: string
  payer?: PawaPayMmoAccount
  customerMessage?: string
  created?: string
  providerTransactionId?: string
  failureReason?: PawaPayFailureReason
  // Flow avec redirection (Wave Senegal / Côte d'Ivoire)
  nextStep?: 'FINAL_STATUS' | 'GET_AUTH_URL' | 'REDIRECT_TO_AUTH_URL'
  authorizationUrl?: string
  successfulUrl?: string
  failedUrl?: string
}

/** Payload du callback `payout`. */
export interface PawaPayPayoutCallback {
  payoutId: string
  status: PawaPayStatus
  amount?: string
  currency?: string
  country?: string
  recipient?: PawaPayMmoAccount
  customerMessage?: string
  created?: string
  providerTransactionId?: string
  failureReason?: PawaPayFailureReason
}

/** Payload du callback `refund`. */
export interface PawaPayRefundCallback {
  refundId: string
  depositId?: string
  status: PawaPayStatus
  amount?: string
  currency?: string
  country?: string
  recipient?: PawaPayMmoAccount
  customerMessage?: string
  created?: string
  providerTransactionId?: string
  failureReason?: PawaPayFailureReason
}

// ============================================================================
// Client HTTP
// ============================================================================

async function pawapayFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!PAWAPAY_API_TOKEN) {
    throw new Error(
      'PAWAPAY_API_TOKEN manquant. Ajoutez-le dans vos variables d\'environnement.'
    )
  }

  const res = await fetch(`${PAWAPAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PAWAPAY_API_TOKEN}`,
      ...(init.headers || {}),
    },
    // Ne jamais cacher les appels paiements
    cache: 'no-store',
  })

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    throw new Error(
      `PawaPay ${path} → HTTP ${res.status}: ${JSON.stringify(json)}`
    )
  }
  return json as T
}

// ============================================================================
// Wallet balances
// ============================================================================

export interface PawaPayWalletBalance {
  country: string
  provider: string
  currency: string
  balance: string
}

export interface PawaPayWalletBalancesResponse {
  balances: PawaPayWalletBalance[]
}

/**
 * Fetch live PawaPay wallet balances per country/provider/currency.
 * Source of truth for available payout funds. Should not be called on the
 * hot render path — wire through a server route with caching.
 */
export async function getWalletBalances() {
  return pawapayFetch<PawaPayWalletBalancesResponse>('/v2/wallet-balances', {
    method: 'GET',
  })
}

// ============================================================================
// Initiate — Deposits / Payouts / Refunds
// ============================================================================

export interface InitiateDepositInput {
  depositId: string // UUIDv4 généré côté merchant
  amount: string // en string, ex. "100" ou "99.50"
  currency: string // ex. XOF, RWF, GHS...
  payer: PawaPayMmoAccount
  customerMessage?: string
  preAuthorisationCode?: string // Orange Burkina
  successfulUrl?: string // Wave SEN/CIV
  failedUrl?: string // Wave SEN/CIV
  metadata?: Array<Record<string, string | boolean>>
}

export async function initiateDeposit(input: InitiateDepositInput) {
  return pawapayFetch<{
    depositId: string
    status: PawaPayStatus
    nextStep?: string
    created: string
    failureReason?: PawaPayFailureReason
  }>('/v2/deposits', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface InitiatePayoutInput {
  payoutId: string
  amount: string
  currency: string
  recipient: PawaPayMmoAccount
  customerMessage?: string
  metadata?: Array<Record<string, string | boolean>>
}

export async function initiatePayout(input: InitiatePayoutInput) {
  return pawapayFetch<{
    payoutId: string
    status: PawaPayStatus
    created: string
    failureReason?: PawaPayFailureReason
  }>('/v2/payouts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface InitiateRefundInput {
  refundId: string
  depositId: string
  amount?: string // si omis → full refund du restant
  currency?: string
  metadata?: Array<Record<string, string | boolean>>
}

export async function initiateRefund(input: InitiateRefundInput) {
  return pawapayFetch<{
    refundId: string
    status: PawaPayStatus
    created: string
    failureReason?: PawaPayFailureReason
  }>('/v2/refunds', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ============================================================================
// Check status — polling de secours si un callback est perdu
// ============================================================================

export interface CheckStatusResponse<T> {
  status: 'FOUND' | 'NOT_FOUND'
  data?: T
}

export function checkDepositStatus(depositId: string) {
  return pawapayFetch<CheckStatusResponse<PawaPayDepositCallback>>(
    `/v2/deposits/${depositId}`,
    { method: 'GET' }
  )
}

export function checkPayoutStatus(payoutId: string) {
  return pawapayFetch<CheckStatusResponse<PawaPayPayoutCallback>>(
    `/v2/payouts/${payoutId}`,
    { method: 'GET' }
  )
}

export function checkRefundStatus(refundId: string) {
  return pawapayFetch<CheckStatusResponse<PawaPayRefundCallback>>(
    `/v2/refunds/${refundId}`,
    { method: 'GET' }
  )
}

// ============================================================================
// Resend callback — pour re-déclencher un callback manquant
// ============================================================================

export function resendDepositCallback(depositId: string) {
  return pawapayFetch(`/v2/deposits/resend-callback/${depositId}`, {
    method: 'POST',
  })
}

export function resendPayoutCallback(payoutId: string) {
  return pawapayFetch(`/v2/payouts/resend-callback/${payoutId}`, {
    method: 'POST',
  })
}

export function resendRefundCallback(refundId: string) {
  return pawapayFetch(`/v2/refunds/resend-callback/${refundId}`, {
    method: 'POST',
  })
}

// ============================================================================
// Toolkit — predict provider & active configuration
// ============================================================================

export function predictProvider(phoneNumber: string) {
  return pawapayFetch<{
    country: string
    provider: string
    phoneNumber: string
  }>('/v2/predict-provider', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  })
}

export function getActiveConfig(params?: {
  country?: string
  operationType?: 'DEPOSIT' | 'PAYOUT' | 'REFUND'
}) {
  const qs = new URLSearchParams()
  if (params?.country) qs.set('country', params.country)
  if (params?.operationType) qs.set('operationType', params.operationType)
  const query = qs.toString()
  return pawapayFetch<any>(
    `/v2/active-conf${query ? `?${query}` : ''}`,
    { method: 'GET' }
  )
}

// ============================================================================
// Helpers de compatibilité (génération de références, URLs de retour)
// ============================================================================

/**
 * Génère une référence commande unique.
 * Avec PawaPay, le depositId doit être un UUIDv4 — donc on l'utilise directement
 * comme ref_command pour simplifier le stockage et le check de statut.
 */
export function generateRefCommand(_prefix: string = 'BF'): string {
  // On pourrait préfixer, mais l'API PawaPay exige un UUIDv4 strict.
  // On retourne donc un UUIDv4 pur ; le préfixe peut être stocké ailleurs.
  // randomUUID() est disponible dans Node 14.17+ et Edge runtime.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('crypto') as typeof import('crypto')
  return randomUUID()
}

/**
 * URL de retour après paiement (pour les flows avec redirection type Wave).
 */
export function getReturnUrl(refCommand: string): string {
  return `${PUBLIC_BASE_URL}/payment/success?ref_command=${encodeURIComponent(refCommand)}`
}

export function getFailedUrl(refCommand: string): string {
  return `${PUBLIC_BASE_URL}/payment/failed?ref_command=${encodeURIComponent(refCommand)}`
}

