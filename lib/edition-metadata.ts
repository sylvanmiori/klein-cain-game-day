import type { Metadata } from 'next';
import type { Edition } from './edition';
import { galleryForSlug, photoWithUse } from './galleries';
import { siteIcons } from './site-icons';
import { sitePath } from './site-path';

const siteUrl = process.env.DEPLOY_TARGET === 'cloudflare'
  ? 'https://kleincain.gameday.report/'
  : 'https://sylvanmiori.github.io/klein-cain-game-day/';

export function resolveEditionImage(edition: Edition): { url: string; alt: string; width: number; height: number } {
  const authoritativeSiteUrl = 'https://kleincain.gameday.report';
  const gallery = galleryForSlug(edition.slug);
  const homePhoto = photoWithUse(gallery, 'home');
  const leadPhoto = photoWithUse(gallery, 'lead');
  const thumbPhoto = photoWithUse(gallery, 'thumb');
  const chosenGalleryPhoto = homePhoto || leadPhoto || thumbPhoto;

  let imagePath = '/og.png';
  let imageAlt = edition.pageTitle;
  let width = 1200;
  let height = 630;

  if (edition.ogImage && edition.ogImage.length > 0 && !edition.ogImage.endsWith('/og.png')) {
    imagePath = edition.ogImage;
    width = 1800;
    height = 1200;
  } else if (chosenGalleryPhoto) {
    imagePath = chosenGalleryPhoto.src;
    imageAlt = chosenGalleryPhoto.alt || edition.pageTitle;
    width = 1800;
    height = 1200;
  } else if (edition.gameStats?.playerOfGame?.image) {
    imagePath = edition.gameStats.playerOfGame.image;
    imageAlt = `${edition.gameStats.playerOfGame.name} - Klein Cain Player of the Game`;
    width = 800;
    height = 800;
  } else if (edition.ogImage && edition.ogImage.length > 0) {
    imagePath = edition.ogImage;
    width = 1200;
    height = 630;
  }

  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return {
    url: `${authoritativeSiteUrl}${cleanPath}`,
    alt: imageAlt,
    width,
    height,
  };
}

/** Titles, descriptions and share cards all come from the edition file, so an
 *  old opponent can never survive in metadata after a new edition ships. */
export function editionMetadata(edition: Edition, siteName: string): Metadata {
  const authoritativeSiteUrl = 'https://kleincain.gameday.report';
  const url = `${authoritativeSiteUrl}/games/week-${edition.week}`;
  const image = resolveEditionImage(edition);

  return {
    metadataBase: new URL(authoritativeSiteUrl),
    icons: siteIcons,
    manifest: sitePath('/site.webmanifest'),
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
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: edition.metaTitle,
      description: edition.metaDescription,
      images: [image.url],
    },
  };
}
