import type { Metadata } from 'next';
import type { Edition } from './edition';
import { sitePath } from './site-path';

const siteUrl = process.env.DEPLOY_TARGET === 'cloudflare'
  ? 'https://kleincain.gameday.report/'
  : 'https://sylvanmiori.github.io/klein-cain-game-day/';

const icons: Metadata['icons'] = {
  icon: [
    { url: sitePath('/favicon-32x32.png'), sizes: '32x32', type: 'image/png' },
    { url: sitePath('/favicon-16x16.png'), sizes: '16x16', type: 'image/png' },
  ],
  shortcut: sitePath('/favicon-32x32.png'),
  apple: [{ url: sitePath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
};

/** Titles, descriptions and share cards all come from the edition file, so an
 *  old opponent can never survive in metadata after a new edition ships. */
export function editionMetadata(edition: Edition, siteName: string): Metadata {
  const url = edition.current ? siteUrl : `${siteUrl}games/week-${edition.week}`;
  const images = edition.ogImage
    ? [{ url: `${siteUrl}${edition.ogImage.replace(/^\//, '')}`, width: 1731, height: 909, alt: edition.pageTitle }]
    : [];

  return {
    metadataBase: new URL(siteUrl),
    icons,
    title: edition.metaTitle,
    description: edition.metaDescription,
    openGraph: {
      title: edition.metaTitle,
      description: edition.socialDescription,
      url,
      siteName,
      images,
      type: 'article',
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title: edition.metaTitle,
      description: edition.metaDescription,
      images: images.map((image) => image.url),
    },
  };
}
