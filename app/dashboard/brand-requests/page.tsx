'use client'

import { useState, useEffect, useMemo, useRef } from "react"
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import {
  Loader2,
  Building2,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Lock,
  Send,
  Facebook,
  Instagram,
  Linkedin,
  ExternalLink,
  BarChart3,
  Link2,
  ArrowRight,
  Copy,
  Rss,
  Check,
  Sparkles,
  ChevronDown,
  FileText,
  X,
} from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SocialCode = 'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok'

interface BrandRequest {
  id: string
  brand_name: string
  brand_urls: string[] | null
  brand_url: string | null   // legacy
  social_networks: SocialCode[] | null
  notes: string | null
  // Multi-valeurs (canoniques)
  countries: string[] | null
  sectors: string[] | null
  // Legacy single-value (compat ascendante avec d'anciens enregistrements)
  country: string | null
  sector: string | null
  objective: string | null
  status: string
  admin_notes: string | null
  devis_amount: number | null
  devis_currency: string | null
  devis_url: string | null
  devis_sent_at: string | null
  devis_accepted_at: string | null
  paid_at: string | null
  payment_reference: string | null
  next_renewal_at: string | null
  auto_renew: boolean | null
  cancelled_at: string | null
  created_at: string
}

// Icône custom pour X (Twitter) & TikTok (lucide n'en fournit pas d'exact)
const XIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2H21l-6.52 7.453L22 22h-6.828l-4.76-6.23L4.8 22H2l6.98-7.98L2 2h6.914l4.32 5.71L18.244 2Zm-1.2 18.2h1.89L7.05 3.72H5.05l11.994 16.48Z" />
  </svg>
)
const TikTokIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.5 3a4.5 4.5 0 0 0 4.5 4.5v3.05a7.5 7.5 0 0 1-4.5-1.5v6.2a6.25 6.25 0 1 1-6.25-6.25c.35 0 .7.03 1.03.1v3.2a3.1 3.1 0 1 0 2.22 2.98V3h3Z" />
  </svg>
)

const SOCIAL_NETWORKS: { code: SocialCode; label: string; Icon: React.FC<{ className?: string }>; color: string }[] = [
  { code: 'facebook',  label: 'Facebook',  Icon: Facebook,   color: 'bg-[#1877F2]' },
  { code: 'instagram', label: 'Instagram', Icon: Instagram,  color: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
  { code: 'linkedin',  label: 'LinkedIn',  Icon: Linkedin,   color: 'bg-[#0A66C2]' },
  { code: 'x',         label: 'X',         Icon: XIcon,      color: 'bg-black' },
  { code: 'tiktok',    label: 'TikTok',    Icon: TikTokIcon, color: 'bg-black' },
]

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  pending:              { label: 'En attente d’analyse',     color: 'bg-yellow-100 text-yellow-800',   icon: Clock },
  quote_in_preparation: { label: 'Devis en préparation',     color: 'bg-orange-100 text-orange-800',   icon: FileText },
  quote_sent:           { label: 'Devis envoyé',             color: 'bg-indigo-100 text-indigo-800',   icon: FileText },
  quote_accepted:       { label: 'En attente de paiement',   color: 'bg-purple-100 text-purple-800',   icon: CheckCircle2 },
  in_payment:           { label: 'En attente de paiement',   color: 'bg-amber-100 text-amber-800',     icon: Loader2 },
  in_production:        { label: 'En cours de traitement',   color: 'bg-blue-100 text-blue-800',       icon: Loader2 },
  completed:            { label: 'Disponible',               color: 'bg-green-100 text-green-800',     icon: CheckCircle2 },
  rejected:             { label: 'Refusée',                  color: 'bg-red-100 text-red-800',         icon: XCircle },
  cancelled:            { label: 'Résiliée',                 color: 'bg-gray-200 text-gray-700',       icon: XCircle },
  // Legacy
  accepted:             { label: 'Acceptée',                 color: 'bg-blue-100 text-blue-800',       icon: CheckCircle2 },
  in_progress:          { label: 'En cours',                 color: 'bg-[#F5F5F5] text-[#0F0F0F]',     icon: Loader2 },
}

const ALLOWED_PLANS = ['free', 'basic', 'pro']

// Texte légal de la case obligatoire avant envoi.
const LEGAL_CONSENT_LABEL =
  "Je reconnais solliciter un service payant et accepte d’être contacté par LAVEIYE."

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandRequestsPage() {
  const [requests, setRequests] = useState<BrandRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [userPlan, setUserPlan] = useState<string>("Free")
  const [userRole, setUserRole] = useState<string>("user")
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Form state — strictement les champs demandés
  // Sélection multi-marques : `brandQuery` est le texte saisi (filtre + ajout free-text),
  // `selectedBrands` est la liste finale de marques pour lesquelles on créera des demandes.
  const [brandQuery, setBrandQuery] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedSocials, setSelectedSocials] = useState<Set<SocialCode>>(new Set())
  const [linksText, setLinksText] = useState("") // un lien par ligne (optionnel)
  // Multi-sélection pays / secteurs : suggestions issues des campagnes existantes
  // + saisie libre autorisée (l'admin qualifie ensuite côté backoffice).
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [countryQuery, setCountryQuery] = useState("")
  const [sectorQuery, setSectorQuery] = useState("")
  const [objective, setObjective] = useState("")
  const [notes, setNotes] = useState("")
  const [legalConsent, setLegalConsent] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelledNotice, setCancelledNotice] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Liste des marques déjà présentes dans les campagnes du backend.
  // Alimente l'autocomplétion du champ "Nom de la marque" et prévient les doublons.
  const [knownBrands, setKnownBrands] = useState<string[]>([])
  // Mapping brand → secteurs déduits depuis les campagnes (ex: { "MTN": ["Télécom"] })
  const [brandSectors, setBrandSectors] = useState<Record<string, string[]>>({})
  // Pays et secteurs extraits du système (suggestions, mais saisie libre acceptée)
  const [knownCountries, setKnownCountries] = useState<string[]>([])
  const [knownSectors, setKnownSectors] = useState<string[]>([])
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const brandInputRef = useRef<HTMLDivElement>(null)

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    if (!brandDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (brandInputRef.current && !brandInputRef.current.contains(e.target as Node)) {
        setBrandDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [brandDropdownOpen])

  const normalizedQuery = brandQuery.trim().toLowerCase()
  const isQueryKnownBrand = normalizedQuery.length > 0 && knownBrands.some(
    (b) => b.toLowerCase() === normalizedQuery
  )
  const isQueryAlreadySelected = normalizedQuery.length > 0 && selectedBrands.some(
    (b) => b.toLowerCase() === normalizedQuery
  )
  // Y a-t-il au moins une marque sélectionnée qui n'est pas répertoriée ?
  // Si oui, le champ "Lien(s)" devient obligatoire.
  const hasNewBrandSelected = selectedBrands.some(
    (b) => !knownBrands.some((k) => k.toLowerCase() === b.toLowerCase())
  )
  const filteredBrands = useMemo(() => {
    const selectedLower = new Set(selectedBrands.map((b) => b.toLowerCase()))
    const base = normalizedQuery
      ? knownBrands.filter((b) => b.toLowerCase().includes(normalizedQuery))
      : knownBrands
    return base.filter((b) => !selectedLower.has(b.toLowerCase())).slice(0, 50)
  }, [knownBrands, normalizedQuery, selectedBrands])

  const addBrand = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (selectedBrands.some((b) => b.toLowerCase() === lower)) return
    setSelectedBrands((prev) => [...prev, trimmed])
    // Pré-cocher les secteurs associés à cette marque dans les campagnes
    const canonical = Object.keys(brandSectors).find((k) => k.toLowerCase() === lower)
    if (canonical && brandSectors[canonical]?.length) {
      setSelectedSectors((prev) => {
        const existing = new Set(prev.map((s) => s.toLowerCase()))
        const toAdd = brandSectors[canonical].filter((s) => !existing.has(s.toLowerCase()))
        return toAdd.length ? [...prev, ...toAdd] : prev
      })
    }
    setBrandQuery("")
    setBrandDropdownOpen(false)
  }

  const removeBrand = (name: string) => {
    const lower = name.toLowerCase()
    setSelectedBrands((prev) => prev.filter((b) => b.toLowerCase() !== lower))
  }

  // Construit l'URL deep-link vers le dashboard filtre par cette marque
  // Exemple : /dashboard?brand=MTN&socials=facebook,instagram
  const buildBrandDeepLink = (name: string, socials?: SocialCode[]) => {
    const params = new URLSearchParams()
    params.set('brand', name)
    if (socials && socials.length > 0) {
      params.set('socials', socials.join(','))
    }
    return `/dashboard?${params.toString()}`
  }

  const copyDeepLink = async (key: string, url: string) => {
    try {
      const full = typeof window !== 'undefined'
        ? `${window.location.origin}${url}`
        : url
      await navigator.clipboard.writeText(full)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* ignore */ }
  }

  // Action handler — accepter / refuser un devis, résilier / réactiver le renouvellement
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  // Paiement Mobile Money du devis
  const [payOpen, setPayOpen] = useState(false)
  const [payRequest, setPayRequest] = useState<BrandRequest | null>(null)
  const [payPhone, setPayPhone] = useState('')
  const [payProvider, setPayProvider] = useState('ORANGE_CIV')
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const PAWAPAY_PROVIDERS = [
    { value: 'MTN_MOMO_CIV', label: 'MTN Mobile Money — Côte d’Ivoire' },
    { value: 'ORANGE_CIV', label: 'Orange Money — Côte d’Ivoire' },
    { value: 'MOOV_CIV', label: 'Moov Money — Côte d’Ivoire' },
    { value: 'WAVE_CIV', label: 'Wave — Côte d’Ivoire' },
    { value: 'WAVE_SEN', label: 'Wave — Sénégal' },
    { value: 'ORANGE_SEN', label: 'Orange Money — Sénégal' },
    { value: 'FREE_SEN', label: 'Free Money — Sénégal' },
    { value: 'ORANGE_BFA', label: 'Orange Money — Burkina Faso' },
    { value: 'MOOV_BFA', label: 'Moov Money — Burkina Faso' },
    { value: 'MTN_MOMO_BEN', label: 'MTN Mobile Money — Bénin' },
    { value: 'MOOV_BEN', label: 'Moov Money — Bénin' },
  ]

  const openPayment = (req: BrandRequest) => {
    setPayRequest(req)
    setPayPhone('')
    setPayError(null)
    setPayOpen(true)
  }
  const submitPayment = async () => {
    if (!payRequest) return
    const cleaned = payPhone.replace(/\D/g, '')
    if (cleaned.length < 9) {
      setPayError('Numéro de téléphone invalide.')
      return
    }
    setPayLoading(true)
    setPayError(null)
    try {
      const res = await fetch('/api/payment/brand-request/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandRequestId: payRequest.id,
          phoneNumber: cleaned,
          provider: payProvider,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPayError(data.error || 'Erreur lors de l’initiation du paiement.')
        setPayLoading(false)
        return
      }
      // Wave : redirection
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
        return
      }
      // PIN flow : page de pending
      window.location.href = `/payment/pending?ref_command=${encodeURIComponent(data.ref_command)}`
    } catch (e: any) {
      setPayError(e?.message || 'Erreur réseau.')
      setPayLoading(false)
    }
  }

  const patchRequest = async (
    id: string,
    action: 'accept_quote' | 'refuse_quote' | 'cancel_renewal' | 'enable_renewal',
    notes?: string,
  ) => {
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/brand-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.request) {
          setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.request } : r)))
        }
      }
    } catch { /* ignore */ } finally {
      setActionLoadingId(null)
    }
  }
  const handleAcceptQuote = (id: string) => {
    if (!confirm('Confirmez-vous l’acceptation du devis ? Vous serez ensuite invité au paiement.')) return
    patchRequest(id, 'accept_quote').then(() => {
      // Ouvre la modale de paiement directement après acceptation
      const updated = requests.find((r) => r.id === id)
      if (updated) openPayment({ ...updated, status: 'quote_accepted' })
    })
  }
  const handleRefuseQuote = (id: string) => {
    const reason = prompt('Souhaitez-vous indiquer une raison ou demander une modification ? (optionnel)')
    if (reason === null) return
    patchRequest(id, 'refuse_quote', reason || undefined)
  }
  const handleCancelRenewal = (id: string) => {
    if (!confirm('Voulez-vous vraiment résilier le renouvellement automatique ? Le suivi restera actif jusqu’à la date de renouvellement prévue.')) return
    patchRequest(id, 'cancel_renewal')
  }
  const handleEnableRenewal = (id: string) => {
    patchRequest(id, 'enable_renewal')
  }

  const supabase = createClient()
  const isAllowed =
    userRole.toLowerCase() === 'admin' ||
    ALLOWED_PLANS.includes(userPlan.toLowerCase())

  // ---------------------------------------------------------------------
  // Agrégation par marque — pour la section "Récap"
  // Regroupe toutes les demandes portant le même nom (insensible à la casse)
  // et fusionne : statuts, réseaux sociaux, liens uniques, date la + récente.
  // ---------------------------------------------------------------------
  type BrandSummary = {
    name: string
    total: number
    statuses: Record<string, number>
    socials: Set<SocialCode>
    urls: Set<string>
    lastRequestedAt: string
  }

  const brandSummaries = useMemo<BrandSummary[]>(() => {
    const map = new Map<string, BrandSummary>()
    for (const r of requests) {
      const key = (r.brand_name || '').trim().toLowerCase()
      if (!key) continue
      let entry = map.get(key)
      if (!entry) {
        entry = {
          name: r.brand_name,
          total: 0,
          statuses: {},
          socials: new Set(),
          urls: new Set(),
          lastRequestedAt: r.created_at,
        }
        map.set(key, entry)
      }
      entry.total += 1
      entry.statuses[r.status] = (entry.statuses[r.status] || 0) + 1
      for (const s of r.social_networks || []) entry.socials.add(s)
      const urlList =
        (r.brand_urls && r.brand_urls.length > 0)
          ? r.brand_urls
          : (r.brand_url ? [r.brand_url] : [])
      for (const u of urlList) entry.urls.add(u)
      if (new Date(r.created_at) > new Date(entry.lastRequestedAt)) {
        entry.lastRequestedAt = r.created_at
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [requests])

  const globalStats = useMemo(() => {
    const total = requests.length
    const uniqueBrands = brandSummaries.length
    const pending = requests.filter((r) => r.status === 'pending').length
    const inProgress = requests.filter(
      (r) => r.status === 'accepted' || r.status === 'in_progress'
    ).length
    const completed = requests.filter((r) => r.status === 'completed').length
    return { total, uniqueBrands, pending, inProgress, completed }
  }, [requests, brandSummaries])

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted || !user) return

        const { data: profile } = await supabase
          .from('users')
          .select('plan, subscription_status, role')
          .eq('id', user.id)
          .single()

        if (!mounted) return
        if (profile) {
          setUserPlan(profile.plan || 'Free')
          setUserRole((profile as any).role || 'user')
        }

        const [reqRes, brandsRes, suggestionsRes] = await Promise.all([
          fetch('/api/brand-requests'),
          fetch('/api/brands'),
          fetch('/api/campaigns/suggestions'),
        ])
        if (!mounted) return
        if (reqRes.ok) {
          const data = await reqRes.json()
          setRequests(data.requests || [])
        }
        if (brandsRes.ok) {
          const data = await brandsRes.json()
          setKnownBrands(Array.isArray(data.brands) ? data.brands : [])
          if (data.brandSectors && typeof data.brandSectors === 'object') {
            setBrandSectors(data.brandSectors)
          }
        }
        if (suggestionsRes.ok) {
          const data = await suggestionsRes.json()
          setKnownCountries(Array.isArray(data.countries) ? data.countries : [])
          setKnownSectors(Array.isArray(data.categories) ? data.categories : [])
        }
      } catch { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    }
    loadData()
    return () => { mounted = false }
  }, [])

  const toggleSocial = (code: SocialCode) => {
    setSelectedSocials((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const resetForm = () => {
    setBrandQuery("")
    setSelectedBrands([])
    setSelectedSocials(new Set())
    setLinksText("")
    setSelectedCountries([])
    setSelectedSectors([])
    setCountryQuery("")
    setSectorQuery("")
    setObjective("")
    setNotes("")
    setLegalConsent(false)
    setSubmitError(null)
  }

  // Toggle helpers pour les multi-select pays/secteurs (insensibles à la casse)
  const toggleCountry = (value: string) => {
    if (!value) return
    const lower = value.toLowerCase()
    setSelectedCountries((prev) =>
      prev.some((c) => c.toLowerCase() === lower)
        ? prev.filter((c) => c.toLowerCase() !== lower)
        : [...prev, value]
    )
  }
  const toggleSector = (value: string) => {
    if (!value) return
    const lower = value.toLowerCase()
    setSelectedSectors((prev) =>
      prev.some((s) => s.toLowerCase() === lower)
        ? prev.filter((s) => s.toLowerCase() !== lower)
        : [...prev, value]
    )
  }

  // Ajout d'une valeur libre (pays / secteur) saisie au clavier — utilisé pour
  // permettre des marchés / secteurs encore non référencés en base. L'admin
  // qualifie ensuite la demande côté backoffice.
  const addCountryFreeText = () => {
    const v = countryQuery.trim()
    if (!v) return
    if (!selectedCountries.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setSelectedCountries((prev) => [...prev, v])
    }
    setCountryQuery("")
  }
  const addSectorFreeText = () => {
    const v = sectorQuery.trim()
    if (!v) return
    if (!selectedSectors.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setSelectedSectors((prev) => [...prev, v])
    }
    setSectorQuery("")
  }

  // Étape 1 : validation des champs et ouverture du pop-up explicatif.
  // L'envoi réel n'a lieu qu'après confirmation explicite (pop-up "Service payant sur devis").
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Si l'utilisateur a tapé du texte sans avoir cliqué "Ajouter", on l'inclut
    // automatiquement comme une marque supplémentaire pour éviter une saisie perdue.
    let brandsToSubmit = [...selectedBrands]
    const pending = brandQuery.trim()
    if (pending && !brandsToSubmit.some((b) => b.toLowerCase() === pending.toLowerCase())) {
      brandsToSubmit.push(pending)
    }

    // Extraction des liens — une URL par ligne (ou séparées par des virgules)
    const brandUrls = linksText
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)

    // Validations client (doublent la validation serveur)
    if (brandsToSubmit.length === 0) {
      setSubmitError("Sélectionnez au moins une marque.")
      return
    }
    if (selectedSocials.size === 0) {
      setSubmitError("Cochez au moins un réseau social.")
      return
    }
    const hasNew = brandsToSubmit.some(
      (b) => !knownBrands.some((k) => k.toLowerCase() === b.toLowerCase())
    )
    if (brandUrls.length === 0 && hasNew) {
      setSubmitError("Au moins un lien est requis pour les nouvelles marques.")
      return
    }
    const invalid = brandUrls.find((u) => {
      try {
        const parsed = new URL(u)
        return parsed.protocol !== 'http:' && parsed.protocol !== 'https:'
      } catch { return true }
    })
    if (invalid) {
      setSubmitError(`Lien invalide : ${invalid}`)
      return
    }
    if (!legalConsent) {
      setSubmitError("Vous devez accepter d'être contacté par LAVEIYE pour soumettre votre demande.")
      return
    }
    if (!objective.trim()) {
      setSubmitError("L’objectif de votre demande est requis.")
      return
    }

    // Synchroniser l'état (au cas où le free-text a été ajouté à la volée)
    setSelectedBrands(brandsToSubmit)
    setBrandQuery("")

    // Tout est valide : on ouvre le pop-up explicatif "Service payant sur devis"
    setCancelledNotice(false)
    setConfirmOpen(true)
  }

  // Étape 2 : envoi effectif après confirmation utilisateur.
  // On crée une demande par marque sélectionnée (mêmes réseaux / liens / notes).
  const performSubmit = async () => {
    setSubmitError(null)
    const brandUrls = linksText
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)

    setSubmitting(true)
    setSuccess(false)
    const created: BrandRequest[] = []
    const errors: string[] = []
    try {
      for (const name of selectedBrands) {
        const trimmed = name.trim()
        if (!trimmed) continue
        try {
          const res = await fetch('/api/brand-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandName: trimmed,
              socialNetworks: Array.from(selectedSocials),
              brandUrls,
              notes: notes.trim() || undefined,
              countries: selectedCountries,
              sectors: selectedSectors,
              objective: objective.trim() || undefined,
            }),
          })
          const data = await res.json().catch(() => ({} as any))
          if (res.ok && data.request) {
            created.push(data.request)
          } else {
            errors.push(`${trimmed} : ${data.error || `Erreur ${res.status}`}`)
          }
        } catch {
          errors.push(`${trimmed} : erreur réseau`)
        }
      }

      if (created.length > 0) {
        setRequests((prev) => [...created, ...prev])
      }

      if (errors.length === 0 && created.length > 0) {
        resetForm()
        setShowForm(false)
        setConfirmOpen(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 6000)
      } else if (created.length > 0) {
        // Succès partiel : on garde le formulaire ouvert pour permettre de retenter
        setSubmitError(
          `${created.length} demande(s) envoyée(s). Échec pour : ${errors.join(' ; ')}`
        )
        setConfirmOpen(false)
      } else {
        setSubmitError(errors.join(' ; ') || "Échec de l'envoi.")
        setConfirmOpen(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelConfirm = () => {
    setConfirmOpen(false)
    setCancelledNotice(true)
    setTimeout(() => setCancelledNotice(false), 5000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F8FB]">
      <DashboardNavbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 pb-12 pt-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#a855f7] shadow-lg shadow-[#F2B33D]/20">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F0F0F]">
                Suivi de marques
              </h1>
            </div>
            <p className="text-[#0F0F0F]/60">
              Soumettez les marques africaines que vous souhaitez voir suivies sur LAVEIYE.
              Notre équipe analysera vos demandes afin de prioriser la curation de contenus.
            </p>
          </div>

          {/* Loader */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#F2B33D]" />
            </div>
          ) : !isAllowed ? null : (
            <>
              {success && (
                <div className="mb-6 flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold mb-0.5">Demande envoyée avec succès !</p>
                    <p>
                      Votre demande de suivi de marque a bien été enregistrée. L'équipe LAVEIYE
                      vous contactera par email afin d'échanger sur votre besoin et vous transmettre
                      une proposition adaptée.
                    </p>
                  </div>
                </div>
              )}

              {cancelledNotice && (
                <div className="mb-6 flex items-start gap-3 rounded-xl bg-[#F5F5F5]/60 border border-[#F5F5F5] p-4">
                  <XCircle className="h-5 w-5 text-[#0F0F0F]/50 shrink-0 mt-0.5" />
                  <div className="text-sm text-[#0F0F0F]/70">
                    <p className="font-semibold mb-0.5 text-[#0F0F0F]">Demande annulée</p>
                    <p>Votre demande n'a pas été envoyée.</p>
                  </div>
                </div>
              )}

              {/* Cartes statistiques globales */}
              {requests.length > 0 && (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-[#F5F5F5] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-[#F2B33D]" />
                      <span className="text-[11px] font-medium text-[#0F0F0F]/60 uppercase tracking-wide">
                        Marques
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#0F0F0F]">{globalStats.uniqueBrands}</p>
                    <p className="text-[11px] text-[#0F0F0F]/50">
                      {globalStats.total} demande{globalStats.total > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#F5F5F5] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-[11px] font-medium text-[#0F0F0F]/60 uppercase tracking-wide">
                        En attente
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#0F0F0F]">{globalStats.pending}</p>
                  </div>
                  <div className="rounded-xl border border-[#F5F5F5] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Loader2 className="h-4 w-4 text-[#0F0F0F]" />
                      <span className="text-[11px] font-medium text-[#0F0F0F]/60 uppercase tracking-wide">
                        En cours
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#0F0F0F]">{globalStats.inProgress}</p>
                  </div>
                  <div className="rounded-xl border border-[#F5F5F5] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-[11px] font-medium text-[#0F0F0F]/60 uppercase tracking-wide">
                        Terminées
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#0F0F0F]">{globalStats.completed}</p>
                  </div>
                </div>
              )}

              {/* Récap par marque */}
              {brandSummaries.length > 0 && (
                <section className="mb-8 rounded-xl border border-[#F5F5F5] bg-white shadow-sm overflow-hidden">
                  <header className="flex items-center gap-2 border-b border-[#F5F5F5] px-5 py-3 bg-[#F4F8FB]">
                    <BarChart3 className="h-4 w-4 text-[#F2B33D]" />
                    <h2 className="text-sm font-bold text-[#0F0F0F] uppercase tracking-wide">
                      Récap par marque
                    </h2>
                    <span className="ml-auto text-xs text-[#0F0F0F]/50">
                      {brandSummaries.length} marque{brandSummaries.length > 1 ? 's' : ''} suivie{brandSummaries.length > 1 ? 's' : ''}
                    </span>
                  </header>

                  <div className="divide-y divide-[#F5F5F5]">
                    {brandSummaries.map((b) => {
                      const socials = Array.from(b.socials)
                      const urls = Array.from(b.urls)
                      return (
                        <div key={b.name.toLowerCase()} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            {/* Nom + compteur */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F2B33D]/10 text-[#F2B33D] font-bold text-sm shrink-0">
                                {b.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-[#0F0F0F] truncate">{b.name}</h3>
                                <p className="text-xs text-[#0F0F0F]/50">
                                  {b.total} demande{b.total > 1 ? 's' : ''} · Dernière le{' '}
                                  {new Date(b.lastRequestedAt).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Statuts empilés */}
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(b.statuses).map(([st, n]) => {
                                const info = statusLabels[st] || statusLabels.pending
                                return (
                                  <span
                                    key={st}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.color}`}
                                    title={`${n} ${info.label.toLowerCase()}`}
                                  >
                                    {info.label} · {n}
                                  </span>
                                )
                              })}
                            </div>
                          </div>

                          {/* Métadonnées cumulées */}
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#0F0F0F]/60">
                            {socials.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[#0F0F0F]/70">Réseaux :</span>
                                <div className="flex gap-1">
                                  {socials.map((code) => {
                                    const spec = SOCIAL_NETWORKS.find((s) => s.code === code)
                                    if (!spec) return null
                                    const { Icon, color } = spec
                                    return (
                                      <span
                                        key={code}
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-white ${color}`}
                                        title={spec.label}
                                      >
                                        <Icon className="h-3 w-3" />
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Link2 className="h-3.5 w-3.5" />
                              <span>
                                {urls.length} lien{urls.length > 1 ? 's' : ''} unique{urls.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {((b.statuses['completed'] || 0) + (b.statuses['accepted'] || 0)) > 0 && (() => {
                            const deepLink = buildBrandDeepLink(b.name, socials as SocialCode[])
                            const key = `brand-${b.name.toLowerCase()}`
                            const copied = copiedKey === key
                            const rssUrl = `/api/rss/brand/${encodeURIComponent(b.name)}`
                            return (
                              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#F2B33D]/20 bg-[#F2B33D]/5 px-3 py-2">
                                <span className="text-[11px] font-semibold text-[#0F0F0F]/60 uppercase tracking-wide shrink-0">
                                  Marque suivie
                                </span>
                                <code className="flex-1 min-w-0 truncate text-xs text-[#0F0F0F]/80 font-mono">
                                  {deepLink}
                                </code>
                                <a
                                  href={rssUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Flux RSS — ${b.name}`}
                                  className="inline-flex items-center gap-1 h-7 rounded-md border border-orange-300 bg-white px-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                                >
                                  <Rss className="h-3 w-3" />
                                  RSS
                                </a>
                                <Link href={deepLink}>
                                  <Button size="sm" className="h-7 bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-xs">
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Voir les campagnes
                                  </Button>
                                </Link>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => copyDeepLink(key, deepLink)}
                                  title="Copier le lien"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  {copied ? 'Copié !' : 'Copier'}
                                </Button>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Barre d'action */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-[#0F0F0F]/60">
                  {requests.length} demande{requests.length > 1 ? 's' : ''} enregistrée{requests.length > 1 ? 's' : ''}
                </p>
                <Button
                  onClick={() => { setShowForm(!showForm); setSubmitError(null) }}
                  className="bg-[#F2B33D] hover:bg-[#F2B33D]/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle demande
                </Button>
              </div>

              {/* Formulaire */}
              {showForm && (
                <form
                  onSubmit={handleSubmit}
                  className="mb-8 rounded-xl border border-[#F5F5F5] bg-white p-6 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-[#0F0F0F] mb-2">
                    Nouvelle demande de suivi de marque
                  </h2>

                  {/* Bandeau d'explication : il s'agit d'une prestation sur devis
                      et non d'un service automatique intégré à la plateforme. */}
                  <div className="mb-5 rounded-lg border border-[#F2B33D]/30 bg-[#F2B33D]/5 p-4 text-sm text-[#0F0F0F]/80 space-y-1.5">
                    <p className="font-semibold text-[#0F0F0F] flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#F2B33D]" />
                      Une prestation sur mesure, pas un suivi automatique
                    </p>
                    <p>
                      Cette demande <strong>ne déclenche pas un suivi automatique ou régulier</strong> intégré
                      à la plateforme. Il s'agit d'une <strong>prestation spécifique réalisée sur demande</strong>,
                      pour laquelle l'équipe LAVEIYE analyse une ou plusieurs marques selon un périmètre défini
                      avec vous.
                    </p>
                    <p className="text-xs text-[#0F0F0F]/60">
                      Renseignez les éléments ci-dessous pour permettre à l'équipe d'évaluer la demande et
                      d'établir un devis adapté. Les pays et secteurs sont des suggestions — vous pouvez
                      saisir librement ceux qui ne figurent pas dans la liste.
                    </p>
                  </div>

                  {/* 1) Marques — multi-sélection avec autocomplétion */}
                  <div className="mb-5">
                    <label htmlFor="brandName" className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                      Marques à suivre <span className="text-red-500">*</span>
                      <span className="ml-2 text-xs font-normal text-[#0F0F0F]/50">
                        (sélectionnez-en autant que nécessaire)
                      </span>
                    </label>

                    {/* Chips des marques déjà sélectionnées */}
                    {selectedBrands.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selectedBrands.map((b) => {
                          const isKnown = knownBrands.some((k) => k.toLowerCase() === b.toLowerCase())
                          return (
                            <span
                              key={b}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                                isKnown
                                  ? 'bg-[#F2B33D]/10 border-[#F2B33D]/30 text-[#0F0F0F]'
                                  : 'bg-[#F5F5F5]/60 border-[#F5F5F5] text-[#0F0F0F]'
                              }`}
                            >
                              {!isKnown && <Sparkles className="h-3 w-3 text-[#F2B33D]" />}
                              {b}
                              <button
                                type="button"
                                onClick={() => removeBrand(b)}
                                className="ml-0.5 rounded-full p-0.5 hover:bg-black/5"
                                aria-label={`Retirer ${b}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <div ref={brandInputRef} className="relative">
                      <input
                        id="brandName"
                        type="text"
                        value={brandQuery}
                        onChange={(e) => { setBrandQuery(e.target.value); setBrandDropdownOpen(true) }}
                        onFocus={() => setBrandDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (brandQuery.trim() && !isQueryAlreadySelected) {
                              addBrand(brandQuery)
                            }
                          } else if (e.key === 'Backspace' && !brandQuery && selectedBrands.length > 0) {
                            // Retire la dernière chip avec Backspace sur input vide
                            removeBrand(selectedBrands[selectedBrands.length - 1])
                          }
                        }}
                        autoComplete="off"
                        placeholder={
                          selectedBrands.length === 0
                            ? "Ex: MTN, Orange, Coca-Cola..."
                            : "Ajouter une autre marque..."
                        }
                        className="w-full rounded-lg border border-[#F5F5F5] pl-3 pr-20 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20"
                      />
                      {brandQuery.trim() && !isQueryAlreadySelected && (
                        <button
                          type="button"
                          onClick={() => addBrand(brandQuery)}
                          className="absolute right-9 top-1/2 -translate-y-1/2 rounded-md bg-[#F2B33D] px-2 py-1 text-xs font-semibold text-white hover:bg-[#F2B33D]/90"
                        >
                          Ajouter
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setBrandDropdownOpen((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#0F0F0F]/40 hover:text-[#0F0F0F]/70"
                        aria-label="Afficher les marques"
                        tabIndex={-1}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${brandDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {brandDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[#F5F5F5] bg-white shadow-lg">
                          {filteredBrands.length > 0 ? (
                            <ul className="py-1">
                              {filteredBrands.map((b) => (
                                <li key={b}>
                                  <button
                                    type="button"
                                    onClick={() => addBrand(b)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#F4F8FB] text-[#0F0F0F]"
                                  >
                                    <span className="truncate">{b}</span>
                                    <Plus className="h-4 w-4 shrink-0 text-[#0F0F0F]/40" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-3 py-3 text-xs text-[#0F0F0F]/50">
                              {knownBrands.length === 0
                                ? "Aucune marque répertoriée pour le moment."
                                : normalizedQuery
                                  ? "Aucune marque ne correspond — appuyez sur Entrée ou « Ajouter » pour créer une nouvelle demande."
                                  : "Toutes les marques répertoriées sont déjà sélectionnées."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Badge d'état global */}
                    {selectedBrands.length > 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs">
                        {hasNewBrandSelected ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-[#F2B33D]" />
                            <span className="text-[#0F0F0F]/60">
                              {selectedBrands.length === 1
                                ? "Nouvelle marque — merci d'indiquer au moins un lien ci-dessous."
                                : "Au moins une nouvelle marque sélectionnée — merci d'indiquer au moins un lien ci-dessous."}
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-700">
                              {selectedBrands.length === 1
                                ? "Marque déjà suivie — les liens ne sont pas nécessaires."
                                : "Toutes les marques sont déjà suivies — les liens ne sont pas nécessaires."}
                            </span>
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* 2) Réseaux sociaux (checkboxes) */}
                  <fieldset className="mb-5">
                    <legend className="block text-sm font-medium text-[#0F0F0F]/80 mb-2">
                      Réseaux sociaux à suivre <span className="text-red-500">*</span>
                    </legend>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SOCIAL_NETWORKS.map(({ code, label, Icon, color }) => {
                        const checked = selectedSocials.has(code)
                        return (
                          <label
                            key={code}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors select-none ${
                              checked
                                ? 'border-[#F2B33D] bg-[#F2B33D]/5 ring-1 ring-[#F2B33D]/20'
                                : 'border-[#F5F5F5] bg-white hover:bg-[#F4F8FB]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSocial(code)}
                              className="sr-only"
                            />
                            <span className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${color}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="text-sm font-medium text-[#0F0F0F] flex-1">{label}</span>
                            <span
                              className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                                checked
                                  ? 'border-[#F2B33D] bg-[#F2B33D]'
                                  : 'border-[#F5F5F5] bg-white'
                              }`}
                              aria-hidden
                            >
                              {checked && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  {/* 3) Liens — masqués si la marque est déjà suivie */}
                  {/* 3) Liens — affichés dès qu'au moins une nouvelle marque est sélectionnée */}
                  {hasNewBrandSelected && (
                    <div className="mb-5">
                      <label htmlFor="brandUrls" className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                        Lien(s) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="brandUrls"
                        value={linksText}
                        onChange={(e) => setLinksText(e.target.value)}
                        rows={4}
                        required
                        placeholder={"https://facebook.com/marque\nhttps://instagram.com/marque\nhttps://tiktok.com/@marque"}
                        className="w-full rounded-lg border border-[#F5F5F5] px-3 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20 font-mono resize-none"
                      />
                      <p className="mt-1 text-xs text-[#0F0F0F]/50">
                        Un lien par ligne. Les URLs doivent commencer par <code>http://</code> ou{' '}
                        <code>https://</code>.
                      </p>
                    </div>
                  )}

                  {/* Pays / Secteur — multi-sélection (chips toggle) + saisie libre */}
                  <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                        Pays ou marchés concernés <span className="text-[#0F0F0F]/40 font-normal">(optionnel)</span>
                      </label>

                      {/* Chips des valeurs sélectionnées — inclut les saisies libres */}
                      {selectedCountries.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {selectedCountries.map((c) => {
                            const isKnown = knownCountries.some((k) => k.toLowerCase() === c.toLowerCase())
                            return (
                              <span
                                key={c}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
                                  isKnown
                                    ? 'bg-[#F2B33D]/10 border-[#F2B33D]/30 text-[#0F0F0F]'
                                    : 'bg-[#F5F5F5]/60 border-[#F5F5F5] text-[#0F0F0F]'
                                }`}
                              >
                                {!isKnown && <Sparkles className="h-3 w-3 text-[#F2B33D]" />}
                                {c}
                                <button
                                  type="button"
                                  onClick={() => toggleCountry(c)}
                                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/5"
                                  aria-label={`Retirer ${c}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Champ de saisie libre */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={countryQuery}
                          onChange={(e) => setCountryQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addCountryFreeText() }
                          }}
                          placeholder="Ajouter un pays (ex : Cameroun, Maroc…)"
                          className="w-full rounded-lg border border-[#F5F5F5] pl-3 pr-20 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20"
                        />
                        {countryQuery.trim() && (
                          <button
                            type="button"
                            onClick={addCountryFreeText}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#F2B33D] px-2 py-1 text-xs font-semibold text-white hover:bg-[#F2B33D]/90"
                          >
                            Ajouter
                          </button>
                        )}
                      </div>

                      {/* Suggestions cliquables */}
                      {knownCountries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#F5F5F5] bg-white p-2 max-h-32 overflow-y-auto">
                          {knownCountries
                            .filter((c) => !selectedCountries.some((s) => s.toLowerCase() === c.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleCountry(c)}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border bg-white border-[#F5F5F5] text-[#0F0F0F]/70 hover:bg-[#F4F8FB]"
                              >
                                <Plus className="h-3 w-3" />
                                {c}
                              </button>
                            ))}
                        </div>
                      )}
                      {selectedCountries.length > 0 && (
                        <p className="mt-1 text-xs text-[#0F0F0F]/50">
                          {selectedCountries.length} pays sélectionné{selectedCountries.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                        Secteurs d'activité <span className="text-[#0F0F0F]/40 font-normal">(optionnel)</span>
                      </label>

                      {/* Chips des valeurs sélectionnées — inclut les saisies libres */}
                      {selectedSectors.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {selectedSectors.map((s) => {
                            const isKnown = knownSectors.some((k) => k.toLowerCase() === s.toLowerCase())
                            return (
                              <span
                                key={s}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
                                  isKnown
                                    ? 'bg-[#F2B33D]/10 border-[#F2B33D]/30 text-[#0F0F0F]'
                                    : 'bg-[#F5F5F5]/60 border-[#F5F5F5] text-[#0F0F0F]'
                                }`}
                              >
                                {!isKnown && <Sparkles className="h-3 w-3 text-[#F2B33D]" />}
                                {s}
                                <button
                                  type="button"
                                  onClick={() => toggleSector(s)}
                                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/5"
                                  aria-label={`Retirer ${s}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Champ de saisie libre */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={sectorQuery}
                          onChange={(e) => setSectorQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addSectorFreeText() }
                          }}
                          placeholder="Ajouter un secteur (ex : Agro-industrie, EdTech…)"
                          className="w-full rounded-lg border border-[#F5F5F5] pl-3 pr-20 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20"
                        />
                        {sectorQuery.trim() && (
                          <button
                            type="button"
                            onClick={addSectorFreeText}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#F2B33D] px-2 py-1 text-xs font-semibold text-white hover:bg-[#F2B33D]/90"
                          >
                            Ajouter
                          </button>
                        )}
                      </div>

                      {/* Suggestions cliquables */}
                      {knownSectors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#F5F5F5] bg-white p-2 max-h-32 overflow-y-auto">
                          {knownSectors
                            .filter((s) => !selectedSectors.some((x) => x.toLowerCase() === s.toLowerCase()))
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => toggleSector(s)}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border bg-white border-[#F5F5F5] text-[#0F0F0F]/70 hover:bg-[#F4F8FB]"
                              >
                                <Plus className="h-3 w-3" />
                                {s}
                              </button>
                            ))}
                        </div>
                      )}
                      {selectedSectors.length > 0 && (
                        <p className="mt-1 text-xs text-[#0F0F0F]/50">
                          {selectedSectors.length} secteur{selectedSectors.length > 1 ? 's' : ''} sélectionné{selectedSectors.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-5">
                    <label htmlFor="objective" className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                      Objectif de la demande <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="objective"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={2}
                      required
                      placeholder="Que cherchez-vous à analyser ? (benchmark, étude de campagne, analyse de positionnement…)"
                      className="w-full rounded-lg border border-[#F5F5F5] px-3 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20 resize-none"
                    />
                  </div>

                  {/* Notes optionnelles */}
                  <div className="mb-5">
                    <label htmlFor="notes" className="block text-sm font-medium text-[#0F0F0F]/80 mb-1.5">
                      Notes complémentaires <span className="text-[#0F0F0F]/40 font-normal">(optionnel)</span>
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Précisions sur vos attentes, périodes ciblées, etc."
                      className="w-full rounded-lg border border-[#F5F5F5] px-3 py-2 text-sm text-[#0F0F0F] outline-none focus:border-[#F2B33D] focus:ring-2 focus:ring-[#F2B33D]/20 resize-none"
                    />
                  </div>

                  {submitError && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  {/* Case à cocher obligatoire — service payant sur devis */}
                  <label
                    className={`mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors select-none ${
                      legalConsent
                        ? 'border-[#F2B33D] bg-[#F2B33D]/5'
                        : 'border-[#F5F5F5] bg-white hover:bg-[#F4F8FB]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={legalConsent}
                      onChange={(e) => setLegalConsent(e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        legalConsent
                          ? 'border-[#F2B33D] bg-[#F2B33D]'
                          : 'border-[#0F0F0F]/30 bg-white'
                      }`}
                      aria-hidden
                    >
                      {legalConsent && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-[#0F0F0F]">
                      {LEGAL_CONSENT_LABEL} <span className="text-red-500">*</span>
                    </span>
                  </label>

                  {/* Bouton soumettre */}
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={submitting || !legalConsent}
                      className="bg-[#F2B33D] hover:bg-[#F2B33D]/90 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Soumettre
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowForm(false); resetForm() }}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              )}

              {/* Liste des demandes */}
              {requests.length === 0 && !showForm ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#F5F5F5] bg-white p-12 text-center">
                  <Building2 className="h-12 w-12 text-[#0F0F0F]/20 mb-4" />
                  <h3 className="text-lg font-bold text-[#0F0F0F] mb-2">Aucune demande</h3>
                  <p className="text-sm text-[#0F0F0F]/60 max-w-md mb-4">
                    Vous n'avez pas encore soumis de marque à suivre.
                  </p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#F2B33D] hover:bg-[#F2B33D]/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle demande
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => {
                    const statusInfo = statusLabels[req.status] || statusLabels.pending
                    const StatusIcon = statusInfo.icon
                    const urls =
                      (req.brand_urls && req.brand_urls.length > 0)
                        ? req.brand_urls
                        : (req.brand_url ? [req.brand_url] : [])
                    const socials = req.social_networks || []

                    return (
                      <div key={req.id} className="rounded-xl border border-[#F5F5F5] bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                              <h3 className="font-bold text-[#0F0F0F]">{req.brand_name}</h3>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.color}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </span>
                            </div>

                            {socials.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {socials.map((code) => {
                                  const spec = SOCIAL_NETWORKS.find((s) => s.code === code)
                                  if (!spec) return null
                                  const { Icon, label, color } = spec
                                  return (
                                    <span
                                      key={code}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${color}`}
                                    >
                                      <Icon className="h-3 w-3" />
                                      {label}
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            {urls.length > 0 && (
                              <ul className="space-y-0.5 mb-2">
                                {urls.map((u, i) => (
                                  <li key={i}>
                                    <a
                                      href={u}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-[#F2B33D] hover:underline break-all"
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      {u}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {req.notes && (
                              <p className="mt-2 text-sm text-[#0F0F0F]/70">{req.notes}</p>
                            )}
                            {(req.country || req.sector || req.objective) && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#0F0F0F]/70">
                                {req.country && (
                                  <p><span className="font-semibold text-[#0F0F0F]/60">Pays :</span> {req.country}</p>
                                )}
                                {req.sector && (
                                  <p><span className="font-semibold text-[#0F0F0F]/60">Secteur :</span> {req.sector}</p>
                                )}
                                {req.objective && (
                                  <p className="sm:col-span-2"><span className="font-semibold text-[#0F0F0F]/60">Objectif :</span> {req.objective}</p>
                                )}
                              </div>
                            )}
                            {req.admin_notes && (
                              <div className="mt-2 rounded-lg bg-[#F5F5F5]/30 p-3">
                                <p className="text-xs font-semibold text-[#0F0F0F]/60 mb-1">
                                  Réponse de l'équipe :
                                </p>
                                <p className="text-sm text-[#0F0F0F]">{req.admin_notes}</p>
                              </div>
                            )}

                            {/* Statut "Devis en préparation" : message d'attente */}
                            {req.status === 'quote_in_preparation' && (
                              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 flex items-start gap-2">
                                <FileText className="h-4 w-4 text-orange-700 shrink-0 mt-0.5" />
                                <p className="text-xs text-orange-900">
                                  Votre demande est faisable. L’équipe LAVEIYE prépare actuellement votre devis.
                                  Vous recevrez une notification dès qu’il sera disponible.
                                </p>
                              </div>
                            )}

                            {/* Bloc Devis — visible dès qu'un devis est envoyé */}
                            {(req.status === 'quote_sent' || req.status === 'quote_accepted' || req.status === 'in_payment') && req.devis_amount != null && (
                              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <FileText className="h-4 w-4 text-indigo-700 shrink-0" />
                                  <p className="text-sm font-bold text-indigo-900">
                                    Devis : {new Intl.NumberFormat('fr-FR').format(req.devis_amount)} {req.devis_currency || 'XOF'}
                                  </p>
                                </div>
                                {req.devis_url && (
                                  <a
                                    href={req.devis_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-800 hover:underline mb-2"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Consulter le PDF
                                  </a>
                                )}
                                {req.status === 'quote_sent' && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      disabled={actionLoadingId === req.id}
                                      onClick={() => handleAcceptQuote(req.id)}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                                    >
                                      {actionLoadingId === req.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <Check className="h-3 w-3 mr-1" />
                                      )}
                                      Accepter le devis
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={actionLoadingId === req.id}
                                      onClick={() => handleRefuseQuote(req.id)}
                                      className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Refuser ou demander une modification
                                    </Button>
                                  </div>
                                )}
                                {req.status === 'quote_accepted' && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => openPayment(req)}
                                      className="bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white text-xs h-8"
                                    >
                                      Payer le devis maintenant
                                    </Button>
                                    <p className="text-[11px] text-indigo-800 mt-1">
                                      Paiement sécurisé par Mobile Money (PawaPay).
                                    </p>
                                  </div>
                                )}
                                {req.status === 'in_payment' && (
                                  <div className="mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openPayment(req)}
                                      className="text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-100"
                                    >
                                      Reprendre le paiement
                                    </Button>
                                    <p className="text-[11px] text-amber-800 mt-1">
                                      En attente du règlement.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Bloc Renouvellement — visible quand la demande est approuvée */}
                            {req.status === 'completed' && req.next_renewal_at && (
                              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 flex flex-wrap items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-700 shrink-0" />
                                <p className="text-xs text-blue-900 flex-1 min-w-0">
                                  {req.auto_renew === false ? (
                                    <>
                                      Renouvellement <strong>résilié</strong>. Marque suivie jusqu'au{' '}
                                      <strong>{new Date(req.next_renewal_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                                    </>
                                  ) : (
                                    <>
                                      Prochain renouvellement le{' '}
                                      <strong>{new Date(req.next_renewal_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                                    </>
                                  )}
                                </p>
                                {req.auto_renew === false ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoadingId === req.id}
                                    onClick={() => handleEnableRenewal(req.id)}
                                    className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-100"
                                  >
                                    Réactiver
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actionLoadingId === req.id}
                                    onClick={() => handleCancelRenewal(req.id)}
                                    className="text-xs h-7 border-red-200 text-red-700 hover:bg-red-50"
                                  >
                                    {actionLoadingId === req.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : null}
                                    Résilier
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* CTA visible quand la demande est terminee : acces direct au dashboard filtre */}
                            {req.status === 'completed' && (() => {
                              const deepLink = buildBrandDeepLink(req.brand_name, socials)
                              const key = `req-${req.id}`
                              const copied = copiedKey === key
                              return (
                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                  <span className="text-xs font-semibold text-green-800 shrink-0">
                                    Campagnes disponibles
                                  </span>
                                  <code className="flex-1 min-w-0 truncate text-xs text-green-900/70 font-mono">
                                    {deepLink}
                                  </code>
                                  <Link href={deepLink}>
                                    <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white text-xs">
                                      <ArrowRight className="h-3 w-3 mr-1" />
                                      Voir
                                    </Button>
                                  </Link>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-green-200"
                                    onClick={() => copyDeepLink(key, deepLink)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    {copied ? 'Copié !' : 'Copier'}
                                  </Button>
                                  <a
                                    href={`/api/rss/brand/${encodeURIComponent(req.brand_name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Flux RSS des campagnes de cette marque"
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-green-200 text-green-800 hover:bg-green-100"
                                    >
                                      <Rss className="h-3 w-3 mr-1" />
                                      RSS
                                    </Button>
                                  </a>
                                </div>
                              )
                            })()}
                          </div>
                          <p className="text-xs text-[#0F0F0F]/40 shrink-0">
                            {new Date(req.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Pop-up explicatif "Service payant sur devis" — confirmation avant envoi */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="brand-confirm-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !submitting && handleCancelConfirm()}
            aria-label="Fermer"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 sm:p-8 z-10">
            <button
              type="button"
              onClick={() => !submitting && handleCancelConfirm()}
              className="absolute right-4 top-4 rounded-full p-1.5 text-[#0F0F0F]/40 hover:bg-[#F5F5F5] hover:text-[#0F0F0F] transition-colors"
              aria-label="Fermer"
              disabled={submitting}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F2B33D]/15">
              <FileText className="h-6 w-6 text-[#F2B33D]" />
            </div>

            <h2
              id="brand-confirm-title"
              className="text-center text-xl font-bold text-[#0F0F0F] mb-2"
            >
              Service payant sur devis
            </h2>

            <p className="text-center text-sm text-[#0F0F0F]/70 mb-2">
              Le suivi personnalisé de marques est un service facturé sur devis.
            </p>
            <p className="text-center text-sm text-[#0F0F0F]/70 mb-6">
              Après réception de votre demande, l'équipe LAVEIYE vous contactera par email afin
              de mieux comprendre votre besoin et vous transmettre une proposition adaptée.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11"
                onClick={handleCancelConfirm}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                className="flex-1 h-11 bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white font-semibold"
                onClick={performSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Envoi…
                  </>
                ) : (
                  "Confirmer ma demande"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de paiement Mobile Money pour le devis */}
      {payOpen && payRequest && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget && !payLoading) setPayOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F0F0F]">Paiement du devis</h3>
                <p className="text-xs text-[#0F0F0F]/60 mt-0.5">
                  {payRequest.brand_name} —{' '}
                  <strong>
                    {payRequest.devis_amount != null
                      ? new Intl.NumberFormat('fr-FR').format(payRequest.devis_amount)
                      : ''}{' '}
                    {payRequest.devis_currency || 'XOF'}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => !payLoading && setPayOpen(false)}
                className="text-[#0F0F0F]/40 hover:text-[#0F0F0F] p-1"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="pay-provider" className="block text-xs font-semibold text-[#0F0F0F] mb-1">
                  Opérateur Mobile Money
                </label>
                <select
                  id="pay-provider"
                  value={payProvider}
                  onChange={(e) => setPayProvider(e.target.value)}
                  disabled={payLoading}
                  className="w-full rounded-lg border border-[#F5F5F5] px-3 py-2 text-sm outline-none focus:border-[#F2B33D] disabled:opacity-50"
                >
                  {PAWAPAY_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="pay-phone" className="block text-xs font-semibold text-[#0F0F0F] mb-1">
                  Numéro de téléphone
                </label>
                <input
                  id="pay-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="ex. 2250707123456"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  disabled={payLoading}
                  className="w-full rounded-lg border border-[#F5F5F5] px-3 py-2 text-sm outline-none focus:border-[#F2B33D] disabled:opacity-50"
                />
                <p className="text-[11px] text-[#0F0F0F]/50 mt-1">
                  Format international, sans le « + », avec l’indicatif pays.
                </p>
              </div>

              {payError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                  {payError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPayOpen(false)}
                disabled={payLoading}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={submitPayment}
                disabled={payLoading}
                className="bg-[#F2B33D] hover:bg-[#F2B33D]/90 text-white"
              >
                {payLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Payer
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
