'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BattingSeasonLine, PitchingSeasonLine, StatsResponse } from './types';

type State = 'loading' | 'ready' | 'empty' | 'error';

const BATTING_COLS = [
  { key: 'name', label: 'Player', numeric: false },
  { key: 'gp', label: 'GP', numeric: true },
  { key: 'ab', label: 'AB', numeric: true },
  { key: 'r', label: 'R', numeric: true },
  { key: 'h', label: 'H', numeric: true },
  { key: '2b', label: '2B', numeric: true },
  { key: '3b', label: '3B', numeric: true },
  { key: 'hr', label: 'HR', numeric: true },
  { key: 'rbi', label: 'RBI', numeric: true },
  { key: 'bb', label: 'BB', numeric: true },
  { key: 'k', label: 'K', numeric: true },
  { key: 'sb', label: 'SB', numeric: true },
  { key: 'avg', label: 'AVG', numeric: true, fmt: 3 },
  { key: 'obp', label: 'OBP', numeric: true, fmt: 3 },
  { key: 'slg', label: 'SLG', numeric: true, fmt: 3 },
  { key: 'ops', label: 'OPS', numeric: true, fmt: 3 },
] as const;

const PITCHING_COLS = [
  { key: 'name', label: 'Player', numeric: false },
  { key: 'gp', label: 'GP', numeric: true },
  { key: 'ip', label: 'IP', numeric: true },
  { key: 'h', label: 'H', numeric: true },
  { key: 'r', label: 'R', numeric: true },
  { key: 'er', label: 'ER', numeric: true },
  { key: 'bb', label: 'BB', numeric: true },
  { key: 'k', label: 'K', numeric: true },
  { key: 'era', label: 'ERA', numeric: true, fmt: 2 },
  { key: 'whip', label: 'WHIP', numeric: true, fmt: 2 },
] as const;

function ipToNumber(ip: string | number): number {
  if (typeof ip === 'number') return ip;
  const m = /^(\d+)(?:\.(\d))?$/.exec(ip.trim());
  if (!m) return Number(ip) || 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 3 : 0);
}

function formatCell(value: unknown, fmt?: number): string {
  if (value == null) return '-';
  if (fmt != null && typeof value === 'number') return value.toFixed(fmt);
  return String(value);
}

function SortHeader<T extends Record<string, unknown>>({
  col,
  sortKey,
  dir,
  onSort,
}: {
  col: { key: string; label: string };
  sortKey: string;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const active = sortKey === col.key;
  return (
    <th className="whitespace-nowrap px-2.5 py-2 text-left">
      <button
        type="button"
        onClick={() => onSort(col.key)}
        className={`inline-flex items-center gap-1 font-extrabold ${active ? 'text-[#12324e]' : 'text-[#9a9aa2]'}`}
        aria-label={`Sort by ${col.label}`}
      >
        {col.label}
        <span aria-hidden="true" className="text-[9px]">
          {active ? (dir === 'asc' ? '▲' : '▼') : '△'}
        </span>
      </button>
    </th>
  );
}

export function BaseballStatsTables() {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<StatsResponse | null>(null);
  const [batSort, setBatSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'ops', dir: 'desc' });
  const [pitSort, setPitSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'era', dir: 'asc' });

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatsResponse>;
      })
      .then((d) => {
        if (!alive) return;
        setData(d);
        const hasLines =
          (Array.isArray(d.batting) && d.batting.length > 0) ||
          (Array.isArray(d.pitching) && d.pitching.length > 0);
        setState(hasLines ? 'ready' : 'empty');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const batting = useMemo(() => {
    if (!data?.batting) return [];
    const rows = [...data.batting];
    rows.sort((a, b) => {
      const ka = a[batSort.key as keyof BattingSeasonLine];
      const kb = b[batSort.key as keyof BattingSeasonLine];
      const va = typeof ka === 'number' ? ka : String(ka ?? '').toLowerCase();
      const vb = typeof kb === 'number' ? kb : String(kb ?? '').toLowerCase();
      if (va < vb) return batSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return batSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, batSort]);

  const pitching = useMemo(() => {
    if (!data?.pitching) return [];
    const rows = [...data.pitching];
    rows.sort((a, b) => {
      let ka = a[pitSort.key as keyof PitchingSeasonLine];
      let kb = b[pitSort.key as keyof PitchingSeasonLine];
      if (pitSort.key === 'ip') {
        ka = ipToNumber(a.ip);
        kb = ipToNumber(b.ip);
      }
      const va = typeof ka === 'number' ? ka : String(ka ?? '').toLowerCase();
      const vb = typeof kb === 'number' ? kb : String(kb ?? '').toLowerCase();
      if (va < vb) return pitSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return pitSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, pitSort]);

  const toggleBat = (key: string) =>
    setBatSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const togglePit = (key: string) =>
    setPitSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  if (state === 'loading') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5" aria-live="polite">
        <p className="text-sm text-[#6e6e73]">Loading stats&hellip;</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-sm font-bold text-[#12324e]">Stats unavailable right now.</p>
        <p className="mt-1 text-sm text-[#6e6e73]">Try refreshing in a bit.</p>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-sm font-bold text-[#12324e]">No stats yet.</p>
        <p className="mt-1 text-sm text-[#6e6e73]">Stats appear here after the first box score is uploaded.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <h2 className="border-b border-[#eef1f5] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
          Batting
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide">
              <tr>
                {BATTING_COLS.map((c) => (
                  <SortHeader key={c.key} col={c} sortKey={batSort.key} dir={batSort.dir} onSort={toggleBat} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f4f8]">
              {batting.map((row) => (
                <tr key={row.player_id} className="hover:bg-[#f7fafc]">
                  {BATTING_COLS.map((c) => (
                    <td key={c.key} className={`whitespace-nowrap px-2.5 py-2 ${c.key === 'name' ? 'font-bold text-[#12324e]' : 'text-[#3a3a3f]'}`}>
                      {formatCell(row[c.key as keyof BattingSeasonLine], (c as { fmt?: number }).fmt)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <h2 className="border-b border-[#eef1f5] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
          Pitching
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide">
              <tr>
                {PITCHING_COLS.map((c) => (
                  <SortHeader key={c.key} col={c} sortKey={pitSort.key} dir={pitSort.dir} onSort={togglePit} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f4f8]">
              {pitching.map((row) => (
                <tr key={row.player_id} className="hover:bg-[#f7fafc]">
                  {PITCHING_COLS.map((c) => (
                    <td key={c.key} className={`whitespace-nowrap px-2.5 py-2 ${c.key === 'name' ? 'font-bold text-[#12324e]' : 'text-[#3a3a3f]'}`}>
                      {formatCell(row[c.key as keyof PitchingSeasonLine], (c as { fmt?: number }).fmt)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[12px] text-[#8a8a92]">Tap any column header to sort.</p>
    </div>
  );
}
