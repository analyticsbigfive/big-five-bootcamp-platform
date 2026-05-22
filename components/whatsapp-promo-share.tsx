'use client'

import { useMemo, useState } from 'react'
import { MessageCircle, Copy, Check } from 'lucide-react'

interface Props {
  promoCode: string
  message?: string
  className?: string
  // Defaults to `/subscribe?promo=<code>` so the recipient lands directly
  // on the paywall with the code pre-filled & auto-applied.
  redirectPath?: string
}

function getAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://laveiye.com'
}

export function WhatsAppPromoShare({
  promoCode,
  message,
  className = '',
  redirectPath = '/subscribe',
}: Props) {
  const [copied, setCopied] = useState(false)

  const link = useMemo(() => {
    const base = getAppUrl().replace(/\/$/, '')
    const sep = redirectPath.includes('?') ? '&' : '?'
    return `${base}${redirectPath}${sep}promo=${encodeURIComponent(promoCode)}`
  }, [promoCode, redirectPath])

  const defaultMessage = `Salut ! 👋

J'utilise *Laveiye*, la bibliothèque créative ouest-africaine — et j'ai un code promo *${promoCode}* qui t'offre 3 mois de plan Basic.

Inscris-toi via ce lien, le code s'applique tout seul :
${link}`

  const fullText = message || defaultMessage
  const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-medium text-sm shadow-md transition"
      >
        <MessageCircle className="w-4 h-4" />
        Partager via WhatsApp
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition"
        aria-label="Copier le lien"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-600" />
            Copié
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copier le lien
          </>
        )}
      </button>
    </div>
  )
}
