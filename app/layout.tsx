import React from "react"
import type { Metadata, Viewport } from 'next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://laveiye.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Laveiye - La référence créative',
  description: 'Benchmarkez, analysez et créez des concepts gagnants en quelques minutes.',
  icons: {
    icon: '/favicon_onglet.png',
    shortcut: '/favicon_onglet.png',
    apple: '/favicon_onglet.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Laveiye',
    title: 'Laveiye - La référence créative',
    description: 'Benchmarkez, analysez et créez des concepts gagnants en quelques minutes.',
    url: siteUrl,
    locale: 'fr_FR',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Laveiye',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laveiye - La référence créative',
    description: 'Benchmarkez, analysez et créez des concepts gagnants en quelques minutes.',
    images: ['/logo.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#F2B33D',
}

import { Providers } from "@/components/providers"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,200..800;1,200..800&family=Outfit:wght@300;400;500;600;700;800&display=swap"
        />
        {/* Préchargement des icônes du menu utilisateur pour éviter le flash au survol/ouverture */}
        <link rel="preload" as="image" href="/icons/Bibliotheque.svg" />
        <link rel="preload" as="image" href="/icons/Temps_forts.svg" />
        <link rel="preload" as="image" href="/icons/Favoris.svg" />
        <link rel="preload" as="image" href="/icons/Collections.svg" />
        <link rel="preload" as="image" href="/icons/Veille.svg" />
        <link rel="preload" as="image" href="/icons/Profil.svg" />
        <link rel="preload" as="image" href="/icons/default-avatar.svg" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
