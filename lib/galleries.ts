import { editions, type Edition } from './edition';

export type PhotoUse = 'lead' | 'recap' | 'home' | 'thumb';

export type GamePhoto = {
  src: string;
  alt: string;
  caption: string;
  /** Where this frame is used beyond the full gallery. */
  use?: PhotoUse[];
};

export type GameGallery = {
  slug: string;
  credit: string;
  galleryUrl: string;
  photos: GamePhoto[];
};

const modules = import.meta.glob('../content/galleries/*.json', { eager: true }) as Record<
  string,
  { default: GameGallery }
>;

export const galleries: GameGallery[] = Object.values(modules).map((module) => module.default);

export function galleryForSlug(slug: string): GameGallery | null {
  return galleries.find((gallery) => gallery.slug === slug) ?? null;
}

export function photoWithUse(gallery: GameGallery | null, use: PhotoUse): GamePhoto | null {
  return gallery?.photos.find((photo) => photo.use?.includes(use)) ?? null;
}

export function recapPhotos(gallery: GameGallery | null): GamePhoto[] {
  if (!gallery) return [];
  const lead = photoWithUse(gallery, 'lead');
  const rest = gallery.photos.filter((photo) => photo.use?.includes('recap') && photo !== lead);
  return lead ? [lead, ...rest] : rest;
}

export type SeasonGallery = GameGallery & { edition: Edition | null };

/** Newest game first. A gallery without a matching edition still appears. */
export function seasonGalleries(): SeasonGallery[] {
  return galleries
    .map((gallery) => ({
      ...gallery,
      edition: editions.find((edition) => edition.slug === gallery.slug) ?? null,
    }))
    .sort((a, b) => (b.edition?.date ?? '').localeCompare(a.edition?.date ?? ''));
}
