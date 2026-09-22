import type { Metadata } from 'next';
import { sitePath } from './site-path';

// Keep one icon definition for the homepage, game reports, and photo gallery.
export const siteIcons: Metadata['icons'] = {
  icon: [
    { url: sitePath('/favicon.svg'), type: 'image/svg+xml' },
    { url: sitePath('/favicon-48x48.png'), sizes: '48x48', type: 'image/png' },
    { url: sitePath('/favicon-192x192.png'), sizes: '192x192', type: 'image/png' },
    { url: sitePath('/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
    { url: sitePath('/favicon-16x16.png'), sizes: '16x16', type: 'image/png' },
  ],
  shortcut: sitePath('/favicon.ico'),
  apple: [{ url: sitePath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
};
