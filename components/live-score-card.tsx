'use client';

import { useCallback, useEffect, useState } from 'react';
import { MatchupCard } from './matchup-card';
import type { Fact, Team } from '../lib/edition';

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
  home: Team;
  away: Team;
  /** Shown before kickoff. */
  scheduledFacts: Fact[];
  /** Shown once the feed reports a live or final score. */
  resultFacts: Fact[];
};

const liveDataUrl = 'https://raw.githubusercontent.com/sylvanmiori/klein-cain-game-day/live-data/live-score.json';

export function LiveScoreCard({
  initialScore,
  dateShort,
  kickoff,
  venue,
  home,
  away,
  scheduledFacts,
  resultFacts,
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const useCloudflare = window.location.hostname === 'kleincain.gameday.report'
        || window.location.hostname.endsWith('.workers.dev');
      const endpoint = useCloudflare ? `/api/score?game=${encodeURIComponent(initialScore.slug)}` : `${liveDataUrl}?t=${Date.now()}`;
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

  const isScheduled = score.status === 'scheduled';
  const updated = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(score.updatedAt));

  // The feed supplies only the score and its provenance. Records, ranks and
  // forecasts stay editorial so polling can never invent them.
  const facts: Fact[] = isScheduled
    ? scheduledFacts
    : [...resultFacts, { label: 'Score source', value: score.source, href: score.sourceUrl }];

  return (
    <MatchupCard
      status={score.status}
      statusLabel={score.statusLabel}
      showLiveDot={score.status === 'live'}
      statusDetail={
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? 'Checking…' : `Updated ${updated} CT`}
        </button>
      }
      dateShort={dateShort}
      kickoff={kickoff}
      venue={venue}
      away={{ ...away, score: score.awayScore }}
      home={{ ...home, score: score.homeScore }}
      facts={facts}
    />
  );
}
