'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StatsResponse } from './types';

type State = 'loading' | 'ready' | 'empty' | 'error';

function parseRecord(games: StatsResponse['games']) {
  let w = 0, l = 0, t = 0;
  let last: StatsResponse['games'][number] | null = null;
  for (const g of games) {
    if (!g.result) continue;
    const c = g.result.trim().charAt(0).toUpperCase();
    if (c === 'W') w += 1;
    else if (c === 'L') l += 1;
    else if (c === 'T') t += 1;
    if (!last || g.date > last.date) last = g;
  }
  return { w, l, t, last };
}

/** Season record strip, fetched live from /api/baseball/stats. */
export function BaseballRecordStrip() {
  const [state, setState] = useState<State>('loading');
  const [record, setRecord] = useState<{ w: number; l: number; t: number; last: StatsResponse['games'][number] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatsResponse>;
      })
      .then((data) => {
        if (!alive) return;
        if (!data || !Array.isArray(data.games) || data.games.length === 0) {
          setState('empty');
          return;
        }
        const rec = parseRecord(data.games);
        if (rec.w + rec.l + rec.t === 0) {
          setState('empty');
          return;
        }
        setRecord(rec);
        setState('ready');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5" aria-live="polite">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <p className="mt-2 text-sm text-[#6e6e73]">Loading record&hellip;</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Season Record</p>
        <p className="mt-2 text-sm text-[#6e6e73]">Record unavailable right now. Try refreshing in a bit.</p>
      </section>
    );
  }

  if (state === 'empty' || !record) {
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
        <Link href="/baseball/stats" className="text-[12px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2">
          Full stats
        </Link>
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
