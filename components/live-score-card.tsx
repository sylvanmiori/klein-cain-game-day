'use client';

import { useCallback, useEffect, useState } from 'react';

export type LiveScore = {
  schemaVersion: number;
  slug: string;
  status: 'scheduled' | 'live' | 'final';
  statusLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  homeRecord: string;
  awayRecord: string;
  updatedAt: string;
  source: string;
  sourceUrl: string;
};

type Props = {
  initialScore: LiveScore;
  dateShort: string;
  kickoff: string;
  venue: string;
  prediction: { home: number; away: number; winProbability: number };
  ranks: { home: number; away: number };
  weather: string;
};

const liveDataUrl = 'https://raw.githubusercontent.com/sylvanmiori/klein-cain-game-day/live-data/live-score.json';

export function LiveScoreCard({ initialScore, dateShort, kickoff, venue, prediction, ranks, weather }: Props) {
  const [score, setScore] = useState(initialScore);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${liveDataUrl}?t=${Date.now()}`, { cache: 'no-store' });
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
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, score.status]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cain-score-status', { detail: score.status }));
  }, [score.status]);

  const isScheduled = score.status === 'scheduled';
  const isLive = score.status === 'live';
  const updated = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(score.updatedAt));

  return (
    <div className={`matchup-card ${score.status}`} aria-label="Oak Ridge at Klein Cain matchup">
      <div className="score-status">
        {isLive && <span className="live-dot" aria-hidden="true" />}
        <strong>{score.statusLabel}</strong>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Checking…' : `Updated ${updated} CT`}
        </button>
      </div>

      <div className="matchup-teams">
        <div className="team away">
          <img src="./oak-ridge-logo.png" alt="Oak Ridge War Eagles logo" />
          <div>
            <h2>Oak Ridge</h2>
            <span>War Eagles</span>
            {isScheduled ? <strong>{score.awayRecord}</strong> : <b className="team-score">{score.awayScore}</b>}
          </div>
        </div>
        <div className="game-time">
          {isScheduled ? <><span>{dateShort}</span><strong>{kickoff}</strong></> : <strong>{score.statusLabel}</strong>}
          <small>{venue}</small>
        </div>
        <div className="team home">
          <div>
            <h2>Klein Cain</h2>
            <span>Hurricanes</span>
            {isScheduled ? <strong>{score.homeRecord}</strong> : <b className="team-score">{score.homeScore}</b>}
          </div>
          <img src="./favicon.png" alt="Klein Cain Hurricanes logo" />
        </div>
      </div>

      {isScheduled ? (
        <ul className="game-facts">
          <li><span>Forecast</span><strong>Cain {prediction.home}–{prediction.away}</strong></li>
          <li><span>Win chance</span><strong>{prediction.winProbability}% Cain</strong></li>
          <li><span>Texas rank</span><strong>Cain {ranks.home} · Oak Ridge {ranks.away}</strong></li>
          <li><span>Weather</span><strong>{weather}</strong></li>
        </ul>
      ) : (
        <ul className="game-facts final-facts">
          <li><span>Defense</span><strong>21 fewer points allowed than Week 1</strong></li>
          <li><span>Record</span><strong>Klein Cain {score.homeRecord}</strong></li>
          <li><span>Next</span><strong>Tomball · Sept. 18</strong></li>
          <li><span>Score source</span><a href={score.sourceUrl} target="_blank" rel="noreferrer">{score.source} ↗</a></li>
        </ul>
      )}
    </div>
  );
}
