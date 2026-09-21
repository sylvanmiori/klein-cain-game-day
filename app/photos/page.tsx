import type { Metadata } from 'next';
import publication from '../../config/publication.json';
import { seasonGalleries } from '../../lib/galleries';
import { apDate, editionPath, opponentOf } from '../../lib/edition';
import { sitePath } from '../../lib/site-path';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: `Photos | ${publication.siteName}`,
  description: `Game photography for ${publication.schoolName} football.`,
};

export default function PhotosPage() {
  const weeks = seasonGalleries();
  return (
    <main>
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
              <div className="compact-head">
                <h2 id={`photos-${gallery.slug}`}>{title}</h2>
                {edition && (
                  <p>
                    <a href={sitePath(editionPath(edition))}>{apDate(edition.date, true)}</a>
                  </p>
                )}
              </div>
              <div className="photo-gallery-grid">
                {gallery.photos.map((photo) => (
                  <figure key={photo.src}>
                    <img src={sitePath(photo.src)} alt={photo.alt} />
                    <figcaption>{photo.caption}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="photo-credit">
                Photo:{' '}
                <a href={gallery.galleryUrl} target="_blank" rel="noreferrer">
                  {gallery.credit}
                </a>
              </p>
            </section>
          );
        })}
      </section>
    </main>
  );
}
