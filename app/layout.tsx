import React from "react"
import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Laveiye - La référence créative',
  description: 'Benchmarkez, analysez et créez des concepts gagnants en quelques minutes.',
  icons: {
    icon: '/favicon_onglet.png',
    shortcut: '/favicon_onglet.png',
    apple: '/favicon_onglet.png',
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
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
