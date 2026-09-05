import type { Metadata } from 'next';
import './globals.css';
import { sitePath } from '../lib/site-path';

export const metadata: Metadata = {
  metadataBase: new URL('https://sylvanmiori.github.io/klein-cain-game-day/'),
  icons: {
    icon: [
      { url: sitePath('/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
      { url: sitePath('/favicon-16x16.png'), sizes: '16x16', type: 'image/png' },
    ],
    shortcut: sitePath('/favicon-32x32.png'),
    apple: [{ url: sitePath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
  },
  title: 'Final: Klein Cain 45, Oak Ridge 20 | Cain Game Day',
  description: 'Final score and game report for Klein Cain’s 45–20 win over Oak Ridge.',
  openGraph: {
    title: 'Final: Klein Cain 45, Oak Ridge 20 | Cain Game Day',
    description: 'Final score, players to know and recruiting notes from Klein Cain’s Week 2 win.',
    url: 'https://sylvanmiori.github.io/klein-cain-game-day/',
    siteName: 'Cain Game Day',
    images: [{ url: 'https://sylvanmiori.github.io/klein-cain-game-day/og.png', width: 1731, height: 909, alt: 'Klein Cain vs Oak Ridge game-day briefing' }],
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Final: Klein Cain 45, Oak Ridge 20 | Cain Game Day',
    description: 'Final score and game report for Klein Cain’s 45–20 win over Oak Ridge.',
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
