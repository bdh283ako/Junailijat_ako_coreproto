import React from 'react'
import type { Metadata } from 'next'
import { Caveat, Inter, Momo_Trust_Display } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './styles.css'

// Mynerve jätetään kokonaan pois: huono luettavuus ja saavutettavuus
// korosteteksteissä (WCAG 2.1/2.2 1.4.3 ja 1.4.4; EU 2016/2102).
// Momo Trust Display on otsikoille, Inter UI-tekstille ja Caveat vain päivämääränumerolle.
const inter = Inter({
  subsets: ['latin', 'latin-ext'], // skandinaavisten merkkien tuki
  variable: '--font-inter',
  display: 'swap',
})

const momoTrustDisplay = Momo_Trust_Display({
  weight: '400', // Momo Trust Display saatavilla vain painolla 400
  subsets: ['latin', 'latin-ext'], // skandinaavisten merkkien tuki
  variable: '--font-momo',
  display: 'swap',
  // Momo Trust Displaylle ei ole bundlattuja fallback-metriikoita,
  // joten estetään turha "Failed to find font override values" -varoitus.
  adjustFontFallback: false,
})

const caveat = Caveat({
  weight: '600',
  subsets: ['latin'],
  variable: '--font-date-numeral',
  display: 'swap',
})

const title = 'Junailijat — perheiden tapahtumat'
const description = 'Löydä tapahtumia ja seuraa pääkaupunkiseudun perheille.'
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title,
  description,
  icons: { icon: '/favicon.svg' },
  openGraph: { title, description },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi">
      <body
        className={`${inter.variable} ${momoTrustDisplay.variable} ${caveat.variable} min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)] antialiased`}
      >
        <a className="skip-link" href="#root">
          Siirry sisältöön
        </a>
        <div id="root" tabIndex={-1}>
          {children}
           <Analytics />
        </div>
        {googleAnalyticsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(googleAnalyticsId)});
`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
