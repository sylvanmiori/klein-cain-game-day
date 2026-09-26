'use client';

import { useEffect, useState } from 'react';
// Plain <a>, not next/link: the baseball host rewrite breaks the App
// Router's client-side navigation (taps silently swallowed). Full-page
// loads always work.
import type { SeasonRecord, StatsResponse } from './types';

function parseRecord(games: StatsResponse['games']): SeasonRecord | null {
  let w = 0, l = 0, t = 0;
  let lastDate = '';
  let last: SeasonRecord['last'] = null;
  for (const g of games) {
    if (!g.result) continue;
    const c = g.result.trim().charAt(0).toUpperCase();
    if (c !== 'W' && c !== 'L' && c !== 'T') continue;
    if (c === 'W') w += 1; else if (c === 'L') l += 1; else t += 1;
    if ((g.date ?? '') >= lastDate) {
      lastDate = g.date ?? '';
      last = { opponent: g.opponent, result: g.result };
    }
  }
  if (w + l + t === 0) return null;
  return { w, l, t, last };
}

/** Season record strip. Live D1 box-score data wins when it loads; the
 *  server-rendered Perfect Game fallback covers the gap (D1 not yet
 *  provisioned, no box scores submitted yet, or a fetch failure). */
export function BaseballRecordStrip({ fallback }: { fallback?: SeasonRecord | null }) {
  const [live, setLive] = useState<SeasonRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatsResponse>;
      })
      .then((data) => {
        if (!alive) return;
        setLive(data && Array.isArray(data.games) ? parseRecord(data.games) : null);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const record = live ?? fallback ?? null;

  if (!loaded) {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5" aria-live="polite">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <p className="mt-2 text-sm text-[#6e6e73]">Loading record&hellip;</p>
      </section>
    );
  }

  if (!record) {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <p className="mt-2 text-sm font-bold text-[#12324e]">No games recorded yet.</p>
        <p className="mt-1 text-sm text-[#6e6e73]">Results will appear here after the first pitch.</p>
      </section>
    );
  }

  const { w, l, t, last } = record;
  return (
    <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
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
          <span className="font-bold text-[#12324e]">Latest result:</span> vs {last.opponent} &mdash; {last.result}
        </p>
      )}
    </section>
  );
}
