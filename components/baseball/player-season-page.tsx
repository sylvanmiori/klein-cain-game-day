'use client';

import { useEffect, useState } from 'react';
import type { PlayerDetailResponse, PlayerGameLogEntry } from './types';

type State = 'loading' | 'ready' | 'error';

const BAT_COLS = [
  { key: 'gp', label: 'GP' },
  { key: 'ab', label: 'AB' },
  { key: 'r', label: 'R' },
  { key: 'h', label: 'H' },
  { key: '2b', label: '2B' },
  { key: '3b', label: '3B' },
  { key: 'hr', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'bb', label: 'BB' },
  { key: 'k', label: 'K' },
  { key: 'sb', label: 'SB' },
  { key: 'avg', label: 'AVG', fmt: 3 },
  { key: 'obp', label: 'OBP', fmt: 3 },
  { key: 'slg', label: 'SLG', fmt: 3 },
  { key: 'ops', label: 'OPS', fmt: 3 },
] as const;

const PIT_COLS = [
  { key: 'gp', label: 'GP' },
  { key: 'ip', label: 'IP' },
  { key: 'h', label: 'H' },
  { key: 'r', label: 'R' },
  { key: 'er', label: 'ER' },
  { key: 'bb', label: 'BB' },
  { key: 'k', label: 'K' },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 'sv', label: 'SV' },
  { key: 'era', label: 'ERA', fmt: 2 },
  { key: 'whip', label: 'WHIP', fmt: 2 },
] as const;

const GAME_BAT_COLS = [
  { key: 'ab', label: 'AB' },
  { key: 'r', label: 'R' },
  { key: 'h', label: 'H' },
  { key: '2b', label: '2B' },
  { key: '3b', label: '3B' },
  { key: 'hr', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'bb', label: 'BB' },
  { key: 'k', label: 'K' },
  { key: 'sb', label: 'SB' },
] as const;

const GAME_PIT_COLS = [
  { key: 'ip', label: 'IP' },
  { key: 'h', label: 'H' },
  { key: 'r', label: 'R' },
  { key: 'er', label: 'ER' },
  { key: 'bb', label: 'BB' },
  { key: 'k', label: 'K' },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 'sv', label: 'SV' },
] as const;

function formatCell(value: unknown, fmt?: number): string {
  if (value == null) return '—';
  if (fmt != null && typeof value === 'number') return value.toFixed(fmt);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

function formatGameDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

function StatTable({
  title,
  cols,
  row,
}: {
  title: string;
  cols: ReadonlyArray<{ key: string; label: string; fmt?: number }>;
  row: Record<string, unknown>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
      <h2 className="border-b border-[#eef1f5] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2.5 py-2 text-left font-extrabold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cols.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-2.5 py-2.5 text-[#3a3a3f]">
                  {formatCell(row[c.key], c.fmt)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GameLogCard({ entry }: { entry: PlayerGameLogEntry }) {
  const { game, batting, pitching } = entry;
  return (
    <li className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
      {/* oxlint-disable-next-line next/no-html-link-for-pages */}
      <a
        href={`/baseball/box-score?game=${game.id}`}
        className="flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3 transition-colors hover:bg-[#f7fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#7BAFD4]"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#12324e]">vs {game.opponent}</span>
          <span className="mt-0.5 block text-[12px] text-[#6e6e73]">{formatGameDate(game.date)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#12324e] px-2.5 py-1 text-[12px] font-extrabold text-white tabular-nums">
          {game.result || 'Box score'} <span aria-hidden="true">›</span>
        </span>
      </a>
      <div className="grid gap-3 px-4 py-3">
        {batting ? (
          <div>
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa2]">
              Batting
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead className="text-[10px] uppercase tracking-wide text-[#9a9aa2]">
                  <tr>
                    {GAME_BAT_COLS.map((c) => (
                      <th key={c.key} className="px-1.5 py-1 text-left font-bold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {GAME_BAT_COLS.map((c) => (
                      <td key={c.key} className="px-1.5 py-1 text-[#3a3a3f]">
                        {formatCell(batting[c.key as keyof typeof batting])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {pitching ? (
          <div>
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa2]">
              Pitching
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead className="text-[10px] uppercase tracking-wide text-[#9a9aa2]">
                  <tr>
                    {GAME_PIT_COLS.map((c) => (
                      <th key={c.key} className="px-1.5 py-1 text-left font-bold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {GAME_PIT_COLS.map((c) => (
                      <td key={c.key} className="px-1.5 py-1 text-[#3a3a3f]">
                        {formatCell(pitching[c.key as keyof typeof pitching])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function PlayerSeasonPage() {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<PlayerDetailResponse | null>(null);
  const [message, setMessage] = useState('That player could not be loaded.');

  useEffect(() => {
    let alive = true;
    const rawId = new URLSearchParams(window.location.search).get('id');
    const playerId = Number(rawId);
    if (!rawId || !Number.isInteger(playerId) || playerId <= 0) {
      queueMicrotask(() => {
        if (!alive) return;
        setMessage('This player link is missing a valid id.');
        setState('error');
      });
      return () => {
        alive = false;
      };
    }

    fetch(`/api/baseball/players/${playerId}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PlayerDetailResponse>;
      })
      .then((payload) => {
        if (!alive) return;
        setData(payload);
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
        <p className="text-sm text-[#6e6e73]">Loading player&hellip;</p>
      </section>
    );
  }

  if (state === 'error' || !data) {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-sm font-extrabold text-[#12324e]">Player unavailable</p>
        <p className="mt-1 text-sm text-[#6e6e73]">{message}</p>
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a
          href="/baseball/stats"
          className="mt-3 inline-block text-sm font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          Return to stats
        </a>
      </section>
    );
  }

  const { player, batting, pitching, games } = data;
  const meta = [
    player.jersey_number != null ? `#${player.jersey_number}` : null,
    player.pos || null,
    player.grad_year ? `Class of ${player.grad_year}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="grid gap-5">
      <header>
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a href="/baseball/stats" className="text-[12px] font-bold text-[#6e6e73] hover:text-[#12324e]">
          ← Stats
        </a>
        <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
          Player Season
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[#12324e]">{player.name}</h1>
        {meta ? <p className="mt-1 text-sm text-[#6e6e73]">{meta}</p> : null}
      </header>

      {batting ? (
        <StatTable
          title="Season Batting"
          cols={BAT_COLS}
          row={batting as unknown as Record<string, unknown>}
        />
      ) : (
        <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
          <p className="text-sm font-bold text-[#12324e]">No batting lines yet</p>
          <p className="mt-1 text-sm text-[#6e6e73]">Season batting appears after the first uploaded box score with this player.</p>
        </section>
      )}

      {pitching ? (
        <StatTable
          title="Season Pitching"
          cols={PIT_COLS}
          row={pitching as unknown as Record<string, unknown>}
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
          Game Log
        </h2>
        {games.length === 0 ? (
          <div className="rounded-2xl border border-[#dde7f0] bg-white p-5">
            <p className="text-sm text-[#6e6e73]">No games recorded for this player yet.</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {games.map((entry) => (
              <GameLogCard key={entry.game.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

