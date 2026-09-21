import type { Metadata, Viewport } from 'next';
import { sitePath } from '../lib/site-path';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#121016',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: sitePath('/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
      { url: sitePath('/favicon-16x16.png'), sizes: '16x16', type: 'image/png' },
    ],
    shortcut: sitePath('/favicon-32x32.png'),
    apple: [{ url: sitePath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
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
