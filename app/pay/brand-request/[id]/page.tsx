/**
 * Page publique : /pay/brand-request/[id]
 *
 * URL envoyée par l'admin au client pour régler le devis d'une demande
 * de suivi de marques. Pas d'auth requise — l'UUID de la demande sert
 * de jeton (non énumérable).
 *
 * Comportement :
 *  - Affiche la marque, le montant et la devise du devis.
 *  - Permet au client d'entrer son numéro Mobile Money + le provider.
 *  - Déclenche /api/payment/brand-request/[id]/pay côté serveur.
 *  - Wave : redirection sur authorizationUrl. Autres : page /payment/pending.
 *  - Si la demande est déjà payée ou inactive : affiche un message clair.
 */

import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { BrandRequestPaymentForm } from './payment-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BrandRequestPaymentPage({ params }: PageProps) {
  const { id } = await params
  if (!id) notFound()

  const admin = getSupabaseAdmin()
  const { data: req } = await admin
    .from('brand_requests')
    .select('id, brand_name, devis_amount, devis_currency, devis_url, status, paid_at')
    .eq('id', id)
    .maybeSingle()

  if (!req) notFound()

  const isPaid = !!req.paid_at
  const isClosed = req.status === 'cancelled' || req.status === 'rejected'
  const hasQuote = !!req.devis_amount && Number(req.devis_amount) > 0

  return (
    <div className="min-h-screen bg-[#F4F8FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#F5F5F5] bg-white p-6 shadow-lg">
        <div className="mb-5 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#F2B33D] to-[#a855f7] mb-3">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-xl font-bold text-[#0F0F0F]">Paiement du devis</h1>
          <p className="text-sm text-[#0F0F0F]/60 mt-1">
            Veille concurrentielle — <strong>{req.brand_name}</strong>
          </p>
        </div>

        {isPaid ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-semibold text-green-800">✓ Paiement déjà reçu</p>
            <p className="text-xs text-green-700 mt-1">Cette demande a été réglée. Aucun paiement supplémentaire n'est requis.</p>
          </div>
        ) : isClosed ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
            <p className="text-sm font-semibold text-red-800">Demande clôturée</p>
            <p className="text-xs text-red-700 mt-1">Cette demande n'accepte plus de paiement (statut : {req.status}).</p>
          </div>
        ) : !hasQuote ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
            <p className="text-sm font-semibold text-amber-800">Devis en cours de préparation</p>
            <p className="text-xs text-amber-700 mt-1">
              Le montant du devis n'a pas encore été défini. Patientez : nous vous transmettrons le lien dès qu'il sera prêt.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-xl border border-[#F2B33D]/30 bg-[#F2B33D]/5 p-4">
              <p className="text-xs font-semibold text-[#0F0F0F]/60 uppercase tracking-wide mb-1">
                Montant à régler
              </p>
              <p className="text-2xl font-bold text-[#0F0F0F]">
                {new Intl.NumberFormat('fr-FR').format(Number(req.devis_amount))}{' '}
                <span className="text-base font-medium text-[#0F0F0F]/60">{req.devis_currency || 'XOF'}</span>
              </p>
              {req.devis_url && (
                <a
                  href={req.devis_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-[#80368D] hover:underline"
                >
                  📄 Consulter le devis (PDF)
                </a>
              )}
            </div>

            <BrandRequestPaymentForm
              brandRequestId={req.id}
              amount={Number(req.devis_amount)}
              currency={req.devis_currency || 'XOF'}
            />
          </>
        )}

        <p className="mt-6 text-center text-[11px] text-[#0F0F0F]/40">
          Paiement sécurisé par PawaPay · Mobile Money
        </p>
      </div>
    </div>
  )
}
