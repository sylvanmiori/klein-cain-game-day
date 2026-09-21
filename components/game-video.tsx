'use client';

import { useState, useRef } from 'react';
import type { VideoHighlight } from '../lib/edition';
import { sitePath } from '../lib/site-path';

export function GameHighlightVideo({ video }: { video: VideoHighlight }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayClick = () => {
    if (videoRef.current) {
      void videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <section className="game-video-section" aria-labelledby="game-video-heading">
      <div className="game-video-header">
        <div>
          <span className="game-video-kicker">Video Highlights</span>
          <h2 id="game-video-heading">{video.title}</h2>
        </div>
        <div className="game-video-meta-tags">
          {video.duration && (
            <span className="game-video-pill duration-pill">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {video.duration}
            </span>
          )}
          <span className="game-video-pill credit-pill">{video.credit}</span>
        </div>
      </div>

      <div className="game-video-container">
        <video
          ref={videoRef}
          className="game-video-player"
          poster={sitePath(video.poster)}
          controls
          playsInline
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src={sitePath(video.src)} type="video/mp4" />
          {video.fallbackSrc && <source src={video.fallbackSrc} type="video/mp4" />}
          <track kind="captions" label="English" srcLang="en" />
          Your browser does not support high-definition video playback.
        </video>

        {!isPlaying && (
          <button
            type="button"
            className="game-video-play-button"
            onClick={handlePlayClick}
            aria-label={`Play ${video.title}`}
          >
            <span className="play-button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className="game-video-footer">
        {video.caption && <p className="game-video-caption">{video.caption}</p>}
        {video.sourceUrl && (
          <a
            href={video.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="game-video-source-link"
          >
            Official broadcast on NFHS Network
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </section>
  );
}
