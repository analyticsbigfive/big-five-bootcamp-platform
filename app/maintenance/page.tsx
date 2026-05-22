import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Mail, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Maintenance - Laveiye',
  description: 'La plateforme Laveiye est temporairement en maintenance.',
}

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#0F0F0F]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12 sm:px-8">
        <div className="mb-12">
          <Image
            src="/logo.png"
            alt="Laveiye"
            width={220}
            height={64}
            priority
            className="h-auto w-44 sm:w-56"
          />
        </div>

        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F2B33D]/30 bg-[#F2B33D]/10 px-4 py-2 text-sm font-semibold text-[#9B6B12]">
            <Clock className="h-4 w-4" />
            Maintenance en cours
          </div>

          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
            On revient très vite.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#0F0F0F]/70">
            Laveiye est temporairement indisponible pendant que nous effectuons
            une mise à jour importante. Les administrateurs peuvent continuer à
            accéder au tableau de bord.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
                <ShieldCheck className="h-5 w-5 text-[#10B981]" />
              </div>
              <div>
                <p className="font-semibold">Vos données restent protégées</p>
                <p className="mt-1 text-sm leading-6 text-[#0F0F0F]/60">
                  Les accès publics sont simplement mis en pause le temps de
                  l'intervention.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
                <Mail className="h-5 w-5 text-[#F2B33D]" />
              </div>
              <div>
                <p className="font-semibold">Besoin d'aide ?</p>
                <p className="mt-1 text-sm leading-6 text-[#0F0F0F]/60">
                  Le support reste joignable à tout moment.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F2B33D] px-5 text-sm font-semibold text-white shadow-lg shadow-[#F2B33D]/25 transition-colors hover:bg-[#d99a2a]"
            >
              Accès admin
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:support@laveiye.com"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0F0F0F]/10 bg-white px-5 text-sm font-semibold text-[#0F0F0F] transition-colors hover:bg-[#F5F5F5]"
            >
              Contacter le support
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
