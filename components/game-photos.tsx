import { recapPhotos, type GameGallery } from '../lib/galleries';
import { sitePath } from '../lib/site-path';

function PhotoCredit({ gallery }: { gallery: GameGallery }) {
  return (
    <p className="photo-credit">
      Photo:{' '}
      <a href={gallery.galleryUrl} target="_blank" rel="noreferrer">
        {gallery.credit}
      </a>
    </p>
  );
}

/** Frames chosen for the recap story, ahead of the full gallery. */
export function RecapPhotoStory({ gallery }: { gallery: GameGallery | null }) {
  const photos = recapPhotos(gallery);
  if (!gallery || photos.length === 0) return null;
  const [lead, ...rest] = photos;
  return (
    <div className="recap-photos">
      <figure className="recap-photo-lead">
        <img src={sitePath(lead.src)} alt={lead.alt} />
        <figcaption>{lead.caption}</figcaption>
      </figure>
      {rest.length > 0 && (
        <div className="recap-photo-grid">
          {rest.map((photo) => (
            <figure key={photo.src}>
              <img src={sitePath(photo.src)} alt={photo.alt} />
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/** Every frame from the week, with the purchase credit once. */
export function GamePhotoGallery({ gallery }: { gallery: GameGallery | null }) {
  if (!gallery || gallery.photos.length === 0) return null;
  return (
    <section className="photo-gallery" id="photos" aria-labelledby="photo-gallery-heading">
      <div className="compact-head">
        <h2 id="photo-gallery-heading">Photos</h2>
        <p>{gallery.photos.length} frames</p>
      </div>
      <div className="photo-gallery-grid">
        {gallery.photos.map((photo) => (
          <figure key={photo.src}>
            <img src={sitePath(photo.src)} alt={photo.alt} />
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
      <PhotoCredit gallery={gallery} />
    </section>
  );
}
