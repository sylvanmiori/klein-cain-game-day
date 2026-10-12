'use client';

import { useEffect, useState } from 'react';
// Plain <a>, not next/link: the baseball host rewrite breaks the App
// Router's client-side navigation (taps silently swallowed). Full-page
// loads always work.
import { computeSeasonRecord, loadLiveBracket } from './live-bracket';
import { loadLiveStats } from './live-stats';
import type { BaseballSchedule, SeasonRecord } from './types';

/** Season record strip. Merges schedule finals, D1 box scores, and live bracket
 *  results (same rules as each game row). The server-rendered schedule fallback
 *  covers the gap until client sources load or if a fetch fails. */
export function BaseballRecordStrip({
  schedule,
  fallback,
}: {
  schedule: BaseballSchedule;
  fallback?: SeasonRecord | null;
}) {
  const [record, setRecord] = useState<SeasonRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadLiveStats(), loadLiveBracket()])
      .then(([stats, bracket]) => {
        if (!alive) return;
        const savedGames = stats && Array.isArray(stats.games) ? stats.games : null;
        setRecord(computeSeasonRecord(schedule, savedGames, bracket));
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setRecord(null);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [schedule]);

  const display = loaded ? (record ?? fallback ?? null) : null;

  if (!loaded) {
    return (
      <section className="min-w-0 rounded-2xl border border-[#dde7f0] bg-white px-4 py-4 sm:px-5 sm:py-5" aria-live="polite">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <p className="mt-2 text-sm text-[#6e6e73]">Loading record&hellip;</p>
      </section>
    );
  }

  if (!display) {
    return (
      <section className="min-w-0 rounded-2xl border border-[#dde7f0] bg-white px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <div className="mt-3 flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f3fb] text-[#12324e]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="9" />
              <path d="M7.5 5.5c2.2 2.4 2.2 10.6 0 13" />
              <path d="M16.5 5.5c-2.2 2.4-2.2 10.6 0 13" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#12324e]">No games recorded yet.</p>
            <p className="mt-0.5 text-sm text-[#6e6e73]">Results will appear here after the first pitch.</p>
          </div>
        </div>
      </section>
    );
  }

  const { w, l, t, last } = display;
  return (
    <section className="min-w-0 rounded-2xl border border-[#dde7f0] bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <a href="/baseball/stats" className="text-[12px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2">
          Full stats
        </a>
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight text-[#12324e] tabular-nums">
        {w}-{l}{t > 0 ? `-${t}` : ''}
      </p>
      {last && last.result && (
        <p className="mt-2 text-sm text-[#6e6e73]">
          <span className="font-bold text-[#12324e]">Latest result:</span> vs {last.opponent} &middot; {last.result}
        </p>
      )}
    </section>
  );
}
