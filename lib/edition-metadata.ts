import type { Metadata } from 'next';
import type { Edition } from './edition';
import { sitePath } from './site-path';

const siteUrl = process.env.DEPLOY_TARGET === 'cloudflare'
  ? 'https://kleincain.gameday.report/'
  : 'https://sylvanmiori.github.io/klein-cain-game-day/';

const icons: Metadata['icons'] = {
  icon: [
    { url: sitePath('/favicon.svg'), type: 'image/svg+xml' },
    { url: sitePath('/favicon-192x192.png'), sizes: '192x192', type: 'image/png' },
    { url: sitePath('/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
    { url: sitePath('/favicon-16x16.png'), sizes: '16x16', type: 'image/png' },
  ],
  shortcut: sitePath('/favicon-32x32.png'),
  apple: [{ url: sitePath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
};

/** Titles, descriptions and share cards all come from the edition file, so an
 *  old opponent can never survive in metadata after a new edition ships. */
export function editionMetadata(edition: Edition, siteName: string): Metadata {
  const authoritativeSiteUrl = 'https://kleincain.gameday.report';
  const url = `${authoritativeSiteUrl}/games/week-${edition.week}`;
  const images = edition.ogImage && edition.ogImage.length > 0
    ? [{ url: `${authoritativeSiteUrl}${edition.ogImage.startsWith('/') ? '' : '/'}${edition.ogImage}`, width: 1731, height: 909, alt: edition.pageTitle }]
    : [{ url: `${authoritativeSiteUrl}/og.png`, width: 1200, height: 630, alt: edition.pageTitle }];

  return {
    metadataBase: new URL(authoritativeSiteUrl),
    icons,
    title: {
      absolute: edition.metaTitle,
    },
    description: edition.metaDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: edition.metaTitle,
      description: edition.socialDescription,
      url,
      siteName,
      images,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: edition.metaTitle,
      description: edition.metaDescription,
      images: images.map((image) => image.url),
    },
  };
}
