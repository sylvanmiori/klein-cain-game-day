import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { sitePath } from '../lib/site-path';
import { siteIcons } from '../lib/site-icons';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#121016',
  width: 'device-width',
  initialScale: 1,
};

const siteUrl = 'https://kleincain.gameday.report';

// Google Analytics 4 measurement ID (public identifier; property "kleincain.gameday.report").
const gaMeasurementId = 'G-KXFWBBSXFL';

// Google Search Console site verification (URL-prefix property https://kleincain.gameday.report/).
const googleSiteVerification = 'Fbe9AwU-P8fFiqVowpWDMmakJH14vp21VGShb5gh2Dc';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: {
    google: googleSiteVerification,
  },
  title: {
    default: 'Klein Cain Football | 2026 Schedule, Scores, Roster & Updates',
    template: '%s | Klein Cain Football',
  },
  description: 'The independent coverage hub for Klein Cain Hurricanes high school football in Houston, TX (District 15-6A). 2026 varsity schedule, live scores, game recaps, stats, roster, and photography.',
  keywords: [
    'Klein Cain football',
    'Klein Cain High School football',
    'Klein Cain Hurricanes football',
    'Klein Cain football schedule 2026',
    'Klein Cain scores',
    'Klein Cain roster',
    'District 15-6A football',
    'Texas high school football',
    'Houston high school football',
    'Klein Memorial Stadium',
  ],
  authors: [{ name: 'Cain Game Day' }],
  creator: 'Cain Game Day',
  publisher: 'Game Day Report',
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    siteName: 'Cain Game Day',
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: 'Klein Cain Football | 2026 Schedule, Scores, Roster & Updates',
    description: 'The independent coverage hub for Klein Cain Hurricanes high school football in Houston, TX (District 15-6A). 2026 varsity schedule, live scores, game recaps, stats, roster, and photography.',
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1200,
        height: 630,
        alt: 'Klein Cain Hurricanes Football',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klein Cain Football | 2026 Schedule, Scores, Roster & Updates',
    description: 'The independent coverage hub for Klein Cain Hurricanes high school football in Houston, TX (District 15-6A). 2026 varsity schedule, live scores, game recaps, stats, roster, and photography.',
    images: [`${siteUrl}/og.png`],
  },
  icons: siteIcons,
  manifest: sitePath('/site.webmanifest'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaMeasurementId}');
          `}
        </Script>
      </body>
    </html>
  );
}
