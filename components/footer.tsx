"use client";

import Link from "next/link"
import { Facebook, Linkedin, Youtube, ArrowUpRight } from "lucide-react"
import Image from "next/image"
import { LegalModal } from "./legal-modal"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [logoUrl, setLogoUrl] = useState("/blcklogo.webp")

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "logo_url")
      .single()
      .then(({ data }) => {
        if (data?.value) setLogoUrl(data.value)
      })
  }, [])

  return (
    <footer className="relative border-t border-border bg-background overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#F2B33D]/30 to-transparent" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#F2B33D]/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#F2B33D]/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Brand section */}
          <div className="lg:col-span-1">
            <Link href="/" className="group inline-flex items-center gap-3 transition-all duration-300">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-[#F2B33D]/20 to-[#F2B33D]/20 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
               <img src="/logo.png" className="w-56"/>
              </div>
            </Link>
            <p className="mt-20 pt-6 text-sm leading-relaxed text-muted-foreground">
             Des milliers de campagnes social media pour inspirer vos prochaines créations.
            </p>
          </div>

          {/* Navigation links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Produit</h3>
              <nav className="mt-4 flex flex-col gap-3">
                <Link href="/#features" className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D]">
                  Fonctionnalités
                  <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link href="/pricing" className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D]">
                  Tarifs
                  <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                {/* <Link href="/dashboard" className="group flex items-center text-sm text-[#0F0F0F]/60 transition-colors hover:text-[#F2B33D]">
                  Démo
                  <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link> */}
              </nav>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Entreprise</h3>
              <nav className="mt-4 flex flex-col gap-3">
                <a href="https://bigfive.solutions" target="_blank" rel="noopener noreferrer" className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D]">
                  Big Five
                  <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
                <Link href="/contact" className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D]">
                  Contact
                  <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </nav>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Legal</h3>
              <nav className="mt-4 flex flex-col gap-3">
                <LegalModal 
                  defaultTab="cgu"
                  trigger={
                    <button className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D] text-left">
                      CGU
                      <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  }
                />
                <LegalModal 
                  defaultTab="cgv"
                  trigger={
                    <button className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D] text-left">
                      CGV
                      <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  }
                />
                <LegalModal 
                  defaultTab="privacy"
                  trigger={
                    <button className="group flex items-center text-sm text-muted-foreground transition-colors hover:text-[#F2B33D] text-left">
                      Confidentialité
                      <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  }
                />
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 md:flex-row">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            &copy; {currentYear} Laveiye powered by{" "}
            <a href="https://bigfive.solutions" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#F2B33D] transition-colors">
              Big Five
            </a>.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-2">
            <Link
              href="https://www.facebook.com/agencebigfive/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground transition-all duration-300 hover:bg-[#F2B33D]/20 hover:text-[#F2B33D] hover:scale-110"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </Link>
            <Link
              href="https://www.linkedin.com/company/big-five-solutions/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground transition-all duration-300 hover:bg-[#0A66C2]/20 hover:text-[#0A66C2] hover:scale-110"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </Link>
            <Link
              href="https://www.youtube.com/channel/UCKe6vzOcThB8uzmwZhjK4QQ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground transition-all duration-300 hover:bg-[#FF0000]/20 hover:text-[#FF0000] hover:scale-110"
              aria-label="YouTube"
            >
              <Youtube className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
