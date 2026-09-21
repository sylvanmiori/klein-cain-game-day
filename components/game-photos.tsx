'use client';

import { useEffect, useRef, useState } from 'react';
import { recapPhotos, type GameGallery, type GamePhoto } from '../lib/galleries';
import { sitePath } from '../lib/site-path';

function ZoomIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  photos: GamePhoto[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isOpen = currentIndex !== null && currentIndex >= 0 && currentIndex < photos.length;
  const currentPhoto = isOpen ? photos[currentIndex] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else if (dialog.open) {
      dialog.close();
      previousActiveElement.current?.focus?.();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && photos.length > 1) {
        e.preventDefault();
        onNavigate((currentIndex! - 1 + photos.length) % photos.length);
      } else if (e.key === 'ArrowRight' && photos.length > 1) {
        e.preventDefault();
        onNavigate((currentIndex! + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const isInside = (
      rect.left <= e.clientX &&
      e.clientX <= rect.right &&
      rect.top <= e.clientY &&
      e.clientY <= rect.bottom
    );
    if (!isInside) {
      onClose();
    }
  };

  return (
    /* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <dialog
      ref={dialogRef}
      className="photo-modal"
      closedby="any"
      aria-label="Photo preview"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      onClose={onClose}
    >
      {currentPhoto && (
        <div className="photo-modal-content" ref={contentRef}>
          <div className="photo-modal-bar">
            <span className="photo-modal-counter">
              {photos.length > 1 ? `${currentIndex! + 1} of ${photos.length}` : 'Photo'}
            </span>
            <button
              type="button"
              className="photo-modal-close"
              onClick={onClose}
              aria-label="Close photo preview (Escape)"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="photo-modal-stage">
            {photos.length > 1 && (
              <button
                type="button"
                className="photo-modal-nav prev"
                onClick={() => onNavigate((currentIndex! - 1 + photos.length) % photos.length)}
                aria-label="Previous photo (Left arrow)"
              >
                <PrevIcon />
              </button>
            )}

            <div className="photo-modal-viewport">
              <img
                src={sitePath(currentPhoto.src)}
                alt={currentPhoto.alt}
                className="photo-modal-img"
              />
            </div>

            {photos.length > 1 && (
              <button
                type="button"
                className="photo-modal-nav next"
                onClick={() => onNavigate((currentIndex! + 1) % photos.length)}
                aria-label="Next photo (Right arrow)"
              >
                <NextIcon />
              </button>
            )}
          </div>

          {currentPhoto.caption && (
            <div className="photo-modal-caption-bar">
              <p className="photo-modal-caption">{currentPhoto.caption}</p>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function PhotoGalleryGrid({ photos }: { photos: GamePhoto[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;

  return (
    <>
      <div className="photo-gallery-grid">
        {photos.map((photo, index) => (
          <figure key={photo.src}>
            <button
              type="button"
              className="photo-trigger"
              onClick={() => setActiveIndex(index)}
              aria-haspopup="dialog"
              aria-label={`View enlarged photo: ${photo.alt}`}
            >
              <img src={sitePath(photo.src)} alt={photo.alt} loading="lazy" />
              <span className="photo-zoom-badge" aria-hidden="true">
                <ZoomIcon />
              </span>
            </button>
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
      <PhotoLightbox
        photos={photos}
        currentIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={(idx) => setActiveIndex(idx)}
      />
    </>
  );
}

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const photos = recapPhotos(gallery);
  if (!gallery || photos.length === 0) return null;
  const [lead, ...rest] = photos;

  return (
    <div className="recap-photos">
      <figure className="recap-photo-lead">
        <button
          type="button"
          className="photo-trigger"
          onClick={() => setActiveIndex(0)}
          aria-haspopup="dialog"
          aria-label={`View enlarged photo: ${lead.alt}`}
        >
          <img src={sitePath(lead.src)} alt={lead.alt} />
          <span className="photo-zoom-badge" aria-hidden="true">
            <ZoomIcon />
          </span>
        </button>
        <figcaption>{lead.caption}</figcaption>
      </figure>
      {rest.length > 0 && (
        <div className="recap-photo-grid">
          {rest.map((photo, i) => (
            <figure key={photo.src}>
              <button
                type="button"
                className="photo-trigger"
                onClick={() => setActiveIndex(i + 1)}
                aria-haspopup="dialog"
                aria-label={`View enlarged photo: ${photo.alt}`}
              >
                <img src={sitePath(photo.src)} alt={photo.alt} loading="lazy" />
                <span className="photo-zoom-badge" aria-hidden="true">
                  <ZoomIcon />
                </span>
              </button>
              <figcaption>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <PhotoLightbox
        photos={photos}
        currentIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={(idx) => setActiveIndex(idx)}
      />
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
      <PhotoGalleryGrid photos={gallery.photos} />
      <PhotoCredit gallery={gallery} />
    </section>
  );
}
