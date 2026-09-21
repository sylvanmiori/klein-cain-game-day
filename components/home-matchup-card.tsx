'use client';

import { useCallback, useEffect, useState } from 'react';
import publication from '../config/publication.json';
import { type Fact, type Team, gameDayShort } from '../lib/edition';
import { sitePath } from '../lib/site-path';
import type { LiveScore } from './live-score-card';

type Props = {
  initialScore: LiveScore;
  editionDate: string;
  kickoff: string;
  venue: string;
  home: Team;
  away: Team;
  scheduledFacts: Fact[];
  previewHref: string;
};

const liveDataUrl = 'https://raw.githubusercontent.com/sylvanmiori/klein-cain-game-day/live-data/live-score.json';

function factValue(facts: Fact[], label: string): Fact | undefined {
  return facts.find((fact) => fact.label.toLowerCase() === label.toLowerCase());
}

export function HomeMatchupCard({
  initialScore,
  editionDate,
  kickoff,
  venue,
  home,
  away,
  scheduledFacts,
  previewHref,
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
      : kickoff;

  return (
    <div className={`home-matchup ${score.status}`} aria-label={`${away.name} at ${home.name} matchup`}>
      <div className="home-matchup-head">
        <div className="home-matchup-time">
          {score.status === 'live' && <span className="live-dot" aria-hidden="true" />}
          <strong>{statusLine}</strong>
          <span>{gameDayShort(editionDate, publication.timezone)}</span>
        </div>
        <span className="home-matchup-district">District 15-6A</span>
        {!isScheduled && (
          <button type="button" className="home-matchup-refresh" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Refresh score'}
          </button>
        )}
      </div>

      <div className="home-matchup-teams">
        <div className="home-matchup-team">
          <img src={sitePath(featured.logo)} alt="" />
          <div>
            <h2>{featured.name}</h2>
            <span>{featured.mascot}</span>
            <strong>{isScheduled ? featured.record : featuredScore}</strong>
          </div>
        </div>

        <div className="home-matchup-vs" aria-hidden="true">
          <span>VS</span>
        </div>

        <div className="home-matchup-team away">
          <img src={sitePath(opponent.logo)} alt="" />
          <div>
            <h2>{opponent.name}</h2>
            <span>{opponent.mascot}</span>
            <strong>{isScheduled ? opponent.record : opponentScore}</strong>
          </div>
        </div>
      </div>

      <div className="home-matchup-foot">
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
        <a className="home-matchup-preview" href={previewHref}>
          Full Preview
        </a>
      </div>
    </div>
  );
}
