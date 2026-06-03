import React from "react"
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'

const GA_ID = 'G-H34KN567Q2'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://laveiye.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Laveiye | Bibliothèque de campagnes marketing africaines',
  description: 'Analysez les campagnes publicitaires et social media en Afrique francophone. Benchmark, veille créative, inspirations et filtres par pays, secteur et marque.',
  icons: {
    icon: '/favicon_onglet.png',
    shortcut: '/favicon_onglet.png',
    apple: '/favicon_onglet.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Laveiye',
    title: 'Laveiye | Bibliothèque de campagnes marketing africaines',
    description: 'Analysez les campagnes publicitaires et social media en Afrique francophone. Benchmark, veille créative, inspirations et filtres par pays, secteur et marque.',
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
    title: 'Laveiye | Bibliothèque de campagnes marketing africaines',
    description: 'Analysez les campagnes publicitaires et social media en Afrique francophone. Benchmark, veille créative, inspirations et filtres par pays, secteur et marque.',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof globalThis.__name!=="function"){globalThis.__name=function(t,n){try{Object.defineProperty(t,"name",{value:n,configurable:true})}catch(e){}return t}}`,
          }}
        />
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        {/* Tawk.to live chat */}
        <Script id="tawk-to" strategy="afterInteractive">
          {`
            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
              var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
              s1.async=true;
              s1.src='https://embed.tawk.to/6a1db0360071501c2cc23ec6/1jq1vgm3s';
              s1.charset='UTF-8';
              s1.setAttribute('crossorigin','*');
              s0.parentNode.insertBefore(s1,s0);
            })();
          `}
        </Script>
      </body>
    </html>
  )
}
