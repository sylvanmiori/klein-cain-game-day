import type { Metadata } from 'next';
import publication from '../../config/publication.json';
import { seasonGalleries } from '../../lib/galleries';
import { apDate, editionPath, opponentOf } from '../../lib/edition';
import { sitePath } from '../../lib/site-path';
import { PhotoGalleryGrid, CameraIcon } from '../../components/game-photos';
import { JsonLd, photosJsonLd } from '../../components/seo-schema';

export const dynamic = 'force-static';

const photosUrl = 'https://kleincain.gameday.report/photos';

export const metadata: Metadata = {
  title: {
    absolute: `Klein Cain Football Photos | 2026 Season Galleries | ${publication.siteName}`,
  },
  description: `High-resolution game photography, player action shots, and gameday photos for ${publication.schoolName} Hurricanes football in Houston, TX.`,
  alternates: {
    canonical: photosUrl,
  },
  openGraph: {
    title: `Klein Cain Football Photos | 2026 Season Galleries | ${publication.siteName}`,
    description: `High-resolution game photography, player action shots, and gameday photos for ${publication.schoolName} Hurricanes football.`,
    url: photosUrl,
    siteName: publication.siteName,
    type: 'website',
    images: [
      {
        url: 'https://kleincain.gameday.report/og.png',
        width: 1200,
        height: 630,
        alt: `${publication.schoolName} Football Photo Gallery`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Klein Cain Football Photos | 2026 Season Galleries | ${publication.siteName}`,
    description: `High-resolution game photography, player action shots, and gameday photos for ${publication.schoolName} Hurricanes football.`,
    images: ['https://kleincain.gameday.report/og.png'],
  },
};

export default function PhotosPage() {
  const weeks = seasonGalleries();
  return (
    <main>
      <JsonLd schema={photosJsonLd()} />
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt="" /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          <a href={sitePath('/')}>Home</a>
          <a href={sitePath('/#schedule')}>Schedule</a>
          <a href={sitePath('/#roster-heading')}>Roster</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="season-photos">
        <div className="program-intro">
          <h1>Photos</h1>
          <p>Game photography from the 2026 season.</p>
        </div>

        {weeks.length === 0 && <p className="season-photos-empty">No game photos yet.</p>}

        {weeks.map((gallery) => {
          const edition = gallery.edition;
          const opponent = edition ? opponentOf(edition, publication.schoolName).name : gallery.slug;
          const title = edition ? `Week ${edition.week}: ${opponent}` : opponent;
          return (
            <section className="photo-gallery" key={gallery.slug} aria-labelledby={`photos-${gallery.slug}`}>
              <div className="compact-head photo-gallery-head">
                <div>
                  <h2 id={`photos-${gallery.slug}`}>{title}</h2>
                  <p className="photo-gallery-byline">
                    <CameraIcon />
                    Photography by{' '}
                    <a href={gallery.galleryUrl} target="_blank" rel="noreferrer" className="photographer-name">
                      {gallery.credit}
                    </a>
                    <span className="photo-count-chip">{gallery.photos.length} photos</span>
                  </p>
                </div>
                {edition && (
                  <p className="photo-gallery-game-link">
                    <a href={sitePath(editionPath(edition))}>{apDate(edition.date, true)} · Game recap →</a>
                  </p>
                )}
              </div>
              <PhotoGalleryGrid photos={gallery.photos} />
              <div className="photo-credit">
                <span>
                  Photography by{' '}
                  <a href={gallery.galleryUrl} target="_blank" rel="noreferrer">
                    {gallery.credit}
                  </a>
                </span>
                <span className="photo-credit-sep" aria-hidden="true">·</span>
                <a href={gallery.galleryUrl} target="_blank" rel="noreferrer" className="photo-credit-link">
                  View full SmugMug album & downloads ↗
                </a>
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
