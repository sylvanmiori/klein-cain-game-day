'use client';

import { useCallback, useEffect, useState } from 'react';
import publication from '../config/publication.json';
import { type Fact, type Team, gameDayLong, gameDayShort } from '../lib/edition';
import { sitePath } from '../lib/site-path';
import type { LiveScore } from './live-score-card';

type Props = {
  initialScore: LiveScore;
  editionDate: string;
  kickoff: string;
  venue: string;
  week: number;
  home: Team;
  away: Team;
  scheduledFacts: Fact[];
  previewHref: string;
  showPreview: boolean;
  heroImageSrc: string;
};

const liveDataUrl = 'https://raw.githubusercontent.com/sylvanmiori/klein-cain-game-day/live-data/live-score.json';

function factValue(facts: Fact[], label: string): Fact | undefined {
  return facts.find((fact) => fact.label.toLowerCase() === label.toLowerCase());
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

export function HomeNextGameCard({
  initialScore,
  editionDate,
  kickoff,
  venue,
  week,
  home,
  away,
  scheduledFacts,
  previewHref,
  showPreview,
  heroImageSrc,
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [refreshing, setRefreshing] = useState(false);
  const featuredName = publication.schoolName;
  const featured = home.name === featuredName ? home : away;
  const opponent = home.name === featuredName ? away : home;
  const featuredScore = home.name === featuredName ? score.homeScore : score.awayScore;
  const opponentScore = home.name === featuredName ? score.awayScore : score.homeScore;
  const isScheduled = score.status === 'scheduled';
  const rank = factValue(scheduledFacts, 'Texas rank');
  const lastMeeting = factValue(scheduledFacts, 'Last meeting');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const useCloudflare = window.location.hostname === 'kleincain.gameday.report'
        || window.location.hostname.endsWith('.workers.dev');
      const endpoint = useCloudflare
        ? `/api/score?game=${encodeURIComponent(initialScore.slug)}`
        : `${liveDataUrl}?t=${Date.now()}`;
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) return;
      const next = (await response.json()) as LiveScore;
      if (next.slug === initialScore.slug) setScore(next);
    } catch {
      // Keep the last verified score when the feed is unavailable.
    } finally {
      setRefreshing(false);
    }
  }, [initialScore.slug]);

  useEffect(() => {
    void refresh();
    if (score.status === 'final') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, score.status]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cain-score-status', { detail: score.status }));
  }, [score.status]);

  const statusLine = score.status === 'live'
    ? score.statusLabel
    : score.status === 'final'
      ? 'Final'
      : null;

  return (
    <article className={`home-next-game ${score.status}`} aria-label={`Next game: ${featured.name} vs. ${opponent.name}`}>
      <div className="home-next-game-feature">
        <div className="home-next-game-glow" aria-hidden="true" />
        <img className="home-next-game-hero" src={heroImageSrc} alt="" decoding="async" />
        <div className="home-next-game-edge" aria-hidden="true" />
        <div className="home-next-game-scrim" aria-hidden="true" />
        <div className="home-next-game-copy">
          <p className="home-kicker">Next game</p>
          <h2>
            <span>{publication.schoolName}</span>
            <span>vs. {opponent.name}</span>
          </h2>
          <p className="home-next-game-meta">
            Week {week} · District 15-6A
          </p>
          <ul className="home-next-game-details">
            <li>
              <IconCalendar />
              {gameDayLong(editionDate, publication.timezone)}
            </li>
            <li>
              <IconClock />
              {kickoff}
            </li>
            <li>
              <IconPin />
              {venue}
            </li>
          </ul>
          {!isScheduled && statusLine && (
            <p className="home-next-game-status">
              {score.status === 'live' && <span className="live-dot" aria-hidden="true" />}
              <strong>{statusLine}</strong>
              <span>{gameDayShort(editionDate, publication.timezone)}</span>
              <button type="button" onClick={() => void refresh()} disabled={refreshing}>
                {refreshing ? 'Checking…' : 'Refresh'}
              </button>
            </p>
          )}
          {showPreview && (
            <a className="home-next-game-cta" href={previewHref}>
              Game Preview →
            </a>
          )}
        </div>
      </div>

      <div className="home-next-game-strip">
        <div className="home-next-game-teams">
          <div className="home-next-game-team">
            <img src={sitePath(featured.logo)} alt="" />
            <div>
              <strong>{featured.name}</strong>
              <span>{isScheduled ? featured.record : featuredScore}</span>
            </div>
          </div>
          <div className="home-next-game-vs" aria-hidden="true">VS</div>
          <div className="home-next-game-team away">
            <img src={sitePath(opponent.logo)} alt="" />
            <div>
              <strong>{opponent.name}</strong>
              <span>{isScheduled ? opponent.record : opponentScore}</span>
            </div>
          </div>
        </div>
        <div className="home-next-game-stats">
          <div>
            <span>Last meeting</span>
            <strong>{lastMeeting?.value ?? '—'}</strong>
          </div>
          <div>
            <span>Texas rank</span>
            {rank?.href ? (
              <a href={rank.href} target="_blank" rel="noreferrer">{rank.value}</a>
            ) : (
              <strong>{rank?.value ?? '—'}</strong>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
