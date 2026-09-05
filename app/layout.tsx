import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sylvanmiori.github.io/klein-cain-game-day/'),
  icons: {
    icon: [
      { url: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: 'favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: 'favicon-32x32.png',
    apple: [{ url: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  title: '2026 Week 2: Oak Ridge at Klein Cain | Cain Game Day',
  description: 'The Sept. 4, 2026 game preview for Oak Ridge at Klein Cain.',
  openGraph: {
    title: '2026 Week 2: Oak Ridge at Klein Cain | Cain Game Day',
    description: 'Records, forecast, players to know and recruiting notes for Sept. 4, 2026.',
    url: 'https://sylvanmiori.github.io/klein-cain-game-day/',
    siteName: 'Cain Game Day',
    images: [{ url: 'https://sylvanmiori.github.io/klein-cain-game-day/og.png', width: 1731, height: 909, alt: 'Klein Cain vs Oak Ridge game-day briefing' }],
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: '2026 Week 2: Oak Ridge at Klein Cain | Cain Game Day',
    description: 'The Sept. 4, 2026 game preview for Oak Ridge at Klein Cain.',
    images: ['https://sylvanmiori.github.io/klein-cain-game-day/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
