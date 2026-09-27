'use client';

import { useEffect, useState } from 'react';
import type {
  GameDetailResponse,
  GameLineBatting,
  GameLinePitching,
} from './types';

const BATTING_COLS = [
  ['ab', 'AB'],
  ['r', 'R'],
  ['h', 'H'],
  ['1b', '1B'],
  ['2b', '2B'],
  ['3b', '3B'],
  ['hr', 'HR'],
  ['rbi', 'RBI'],
  ['bb', 'BB'],
  ['k', 'K'],
  ['sb', 'SB'],
  ['cs', 'CS'],
  ['hbp', 'HBP'],
  ['sf', 'SF'],
  ['sac', 'SAC'],
  ['e', 'E'],
] as const;

const PITCHING_COLS = [
  ['ip', 'IP'],
  ['h', 'H'],
  ['r', 'R'],
  ['er', 'ER'],
  ['bb', 'BB'],
  ['k', 'K'],
  ['hr', 'HR'],
  ['hbp', 'HBP'],
  ['wp', 'WP'],
  ['bf', 'BF'],
  ['pitches', 'P'],
  ['strikes', 'S'],
  ['w', 'W'],
  ['l', 'L'],
  ['sv', 'SV'],
] as const;

function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function inningsToOuts(value: string | number): number {
  const match = /^(\d+)(?:\.(\d))?$/.exec(String(value));
  if (!match) return 0;
  return Number(match[1]) * 3 + Math.min(Number(match[2] ?? 0), 2);
}

function outsToInnings(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function PlayerCell({ row }: { row: GameLineBatting | GameLinePitching }) {
  const details = [
    row.jersey != null ? `#${row.jersey}` : null,
    row.pos || null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <td className="sticky left-0 z-[1] min-w-[148px] bg-white px-3 py-2.5 shadow-[1px_0_0_#eef1f5]">
      <span className="block whitespace-nowrap font-extrabold text-[#12324e]">
        {row.player}
      </span>
      {details ? (
        <span className="mt-0.5 block text-[10px] font-semibold text-[#8a8a92]">
          {details}
        </span>
      ) : null}
    </td>
  );
}

function BattingTable({ rows }: { rows: GameLineBatting[] }) {
  if (rows.length === 0)
    return (
      <p className="px-4 py-4 text-sm text-[#6e6e73]">
        No batting lines were saved.
      </p>
    );

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="min-w-max text-[12px] tabular-nums">
        <caption className="sr-only">Individual batting statistics</caption>
        <thead className="border-b border-[#eef1f5] bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b7b84]">
          <tr>
            <th className="sticky left-0 z-[2] min-w-[148px] bg-[#f8fafc] px-3 py-2 text-left shadow-[1px_0_0_#eef1f5]">
              Player
            </th>
            {BATTING_COLS.map(([key, label]) => (
              <th key={key} className="min-w-10 px-2 py-2 text-center">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f4f8]">
          {rows.map((row) => (
            <tr key={row.player_id}>
              <PlayerCell row={row} />
              {BATTING_COLS.map(([key]) => (
                <td
                  key={key}
                  className="px-2 py-2.5 text-center text-[#3a3a3f]"
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-[#dde7f0] bg-[#f8fafc] font-extrabold text-[#12324e]">
          <tr>
            <td className="sticky left-0 z-[1] bg-[#f8fafc] px-3 py-2.5 shadow-[1px_0_0_#eef1f5]">
              Team totals
            </td>
            {BATTING_COLS.map(([key]) => (
              <td key={key} className="px-2 py-2.5 text-center">
                {rows.reduce((sum, row) => sum + row[key], 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PitchingTable({ rows }: { rows: GameLinePitching[] }) {
  if (rows.length === 0)
    return (
      <p className="px-4 py-4 text-sm text-[#6e6e73]">
        No pitching lines were saved.
      </p>
    );

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="min-w-max text-[12px] tabular-nums">
        <caption className="sr-only">Individual pitching statistics</caption>
        <thead className="border-b border-[#eef1f5] bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#7b7b84]">
          <tr>
            <th className="sticky left-0 z-[2] min-w-[148px] bg-[#f8fafc] px-3 py-2 text-left shadow-[1px_0_0_#eef1f5]">
              Player
            </th>
            {PITCHING_COLS.map(([key, label]) => (
              <th key={key} className="min-w-10 px-2 py-2 text-center">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f4f8]">
          {rows.map((row) => (
            <tr key={row.player_id}>
              <PlayerCell row={row} />
              {PITCHING_COLS.map(([key]) => (
                <td
                  key={key}
                  className="px-2 py-2.5 text-center text-[#3a3a3f]"
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-[#dde7f0] bg-[#f8fafc] font-extrabold text-[#12324e]">
          <tr>
            <td className="sticky left-0 z-[1] bg-[#f8fafc] px-3 py-2.5 shadow-[1px_0_0_#eef1f5]">
              Team totals
            </td>
            {PITCHING_COLS.map(([key]) => (
              <td key={key} className="px-2 py-2.5 text-center">
                {key === 'ip'
                  ? outsToInnings(
                      rows.reduce((sum, row) => sum + inningsToOuts(row.ip), 0),
                    )
                  : rows.reduce((sum, row) => sum + row[key], 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function GameBoxScore() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState<GameDetailResponse | null>(null);
  const [message, setMessage] = useState('That box score could not be loaded.');

  useEffect(() => {
    let alive = true;
    const rawId = new URLSearchParams(window.location.search).get('game');
    const gameId = Number(rawId);
    if (!rawId || !Number.isInteger(gameId) || gameId <= 0) {
      queueMicrotask(() => {
        if (!alive) return;
        setMessage('This box-score link is missing a valid game.');
        setState('error');
      });
      return () => {
        alive = false;
      };
    }

    fetch(`/api/baseball/games/${gameId}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<GameDetailResponse>;
      })
      .then((data) => {
        if (!alive) return;
        setDetail(data);
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
      <section
        className="rounded-2xl border border-[#dde7f0] bg-white p-5"
        aria-live="polite"
      >
        <p className="text-sm text-[#6e6e73]">Loading box score&hellip;</p>
      </section>
    );
  }

  if (state === 'error' || !detail) {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-sm font-extrabold text-[#12324e]">
          Box score unavailable
        </p>
        <p className="mt-1 text-sm text-[#6e6e73]">{message}</p>
        {/* Plain links are intentional: client navigation breaks on the baseball host rewrite. */}
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a
          href="/baseball/schedule"
          className="mt-3 inline-block text-sm font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          Return to schedule
        </a>
      </section>
    );
  }

  const { game, batting, pitching } = detail;
  return (
    <div className="grid gap-5">
      <header>
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a
          href="/baseball/schedule"
          className="text-[12px] font-bold text-[#6e6e73] hover:text-[#12324e]"
        >
          ← Schedule
        </a>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
              Game Box Score
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#12324e]">
              vs {game.opponent}
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {formatDate(game.date)}
            </p>
          </div>
          {game.result ? (
            <span className="shrink-0 rounded-full bg-[#12324e] px-3 py-1.5 text-sm font-black text-white tabular-nums">
              {game.result}
            </span>
          ) : null}
        </div>
        {game.tournament || game.venue ? (
          <p className="mt-2 text-[12px] text-[#6e6e73]">
            {[game.tournament, game.venue].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <div className="border-b border-[#eef1f5] px-4 py-3">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
            Batting
          </h2>
        </div>
        <BattingTable rows={batting} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <div className="border-b border-[#eef1f5] px-4 py-3">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
            Pitching
          </h2>
        </div>
        <PitchingTable rows={pitching} />
      </section>

      <p className="text-[12px] text-[#8a8a92]">
        Swipe either table sideways to see every stat.
      </p>
    </div>
  );
}
