'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BattingSeasonLine,
  PitchingSeasonLine,
  PlayerDetailResponse,
  PlayerGameLogEntry,
} from './types';

type State = 'loading' | 'ready' | 'error';
type TabId = 'summary' | 'gamelog' | 'stats';

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'gamelog', label: 'Game Log' },
  { id: 'stats', label: 'Stats' },
];

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

const SUMMARY_LAST_GAMES = 5;

function parseTab(raw: string | null): TabId {
  if (raw === 'gamelog' || raw === 'game-log' || raw === 'game_log') return 'gamelog';
  if (raw === 'stats') return 'stats';
  return 'summary';
}

function formatCell(value: unknown, fmt?: number): string {
  if (value == null) return '—';
  if (fmt != null && typeof value === 'number') return value.toFixed(fmt);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

/** Yahoo-style rate: .600 instead of 0.600 */
function formatRate(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}

function formatGameDate(date: string, short = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(
    'en-US',
    short
      ? { month: 'numeric', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

function seasonYearFromGames(games: PlayerGameLogEntry[]): number {
  for (const entry of games) {
    const m = /^(\d{4})-/.exec(entry.game.date);
    if (m) return Number(m[1]);
  }
  return new Date().getFullYear();
}

function hasBattingLine(batting: BattingSeasonLine | null): boolean {
  return Boolean(batting && (batting.ab > 0 || batting.gp > 0));
}

function hasPitchingLine(pitching: PitchingSeasonLine | null): boolean {
  if (!pitching) return false;
  if (pitching.gp > 0) return true;
  if (typeof pitching.ip === 'number') return pitching.ip > 0;
  return String(pitching.ip || '').trim() !== '' && String(pitching.ip) !== '0';
}

type KeyStat = { label: string; value: string };

function battingKeyStats(batting: BattingSeasonLine): KeyStat[] {
  if (batting.hr > 0) {
    return [
      { label: 'AVG', value: formatRate(batting.avg) },
      { label: 'HR', value: String(batting.hr) },
      { label: 'RBI', value: String(batting.rbi) },
      { label: 'R', value: String(batting.r) },
    ];
  }
  return [
    { label: 'AVG', value: formatRate(batting.avg) },
    { label: 'H', value: String(batting.h) },
    { label: 'RBI', value: String(batting.rbi) },
    { label: 'OPS', value: formatRate(batting.ops) },
  ];
}

function pitchingKeyStats(pitching: PitchingSeasonLine): KeyStat[] {
  return [
    { label: 'ERA', value: formatCell(pitching.era, 2) },
    { label: 'IP', value: formatCell(pitching.ip) },
    { label: 'K', value: String(pitching.k) },
    { label: 'WHIP', value: formatCell(pitching.whip, 2) },
  ];
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

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
      <p className="text-sm font-bold text-[#12324e]">{title}</p>
      <p className="mt-1 text-sm text-[#6e6e73]">{body}</p>
    </section>
  );
}

function GameLogTable({
  games,
  mode,
}: {
  games: PlayerGameLogEntry[];
  mode: 'compact' | 'full';
}) {
  const showBat = games.some((g) => g.batting);
  const showPit = games.some((g) => g.pitching);
  const rows = mode === 'compact' ? games.slice(0, SUMMARY_LAST_GAMES) : games;

  if (rows.length === 0) {
    return <EmptyCard title="No games yet" body="Game lines appear after the first uploaded box score with this player." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[12px] tabular-nums">
          <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left font-extrabold">Date</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-extrabold">Opp</th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-extrabold">Result</th>
              {showBat
                ? GAME_BAT_COLS.map((c) => (
                    <th key={`b-${c.key}`} className="whitespace-nowrap px-2 py-2 text-right font-extrabold">
                      {c.label}
                    </th>
                  ))
                : null}
              {showPit
                ? GAME_PIT_COLS.map((c) => (
                    <th key={`p-${c.key}`} className="whitespace-nowrap px-2 py-2 text-right font-extrabold">
                      {showBat ? `P-${c.label}` : c.label}
                    </th>
                  ))
                : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const { game, batting, pitching } = entry;
              return (
                <tr key={game.id} className="border-b border-[#eef1f5] last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#6e6e73]">
                    {formatGameDate(game.date, mode === 'compact')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {/* oxlint-disable-next-line next/no-html-link-for-pages */}
                    <a
                      href={`/baseball/box-score?game=${game.id}`}
                      className="font-bold text-[#12324e] underline decoration-[#7BAFD4]/50 decoration-2 underline-offset-2 hover:decoration-[#7BAFD4]"
                    >
                      {game.opponent}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[#3a3a3f]">{game.result || '—'}</td>
                  {showBat
                    ? GAME_BAT_COLS.map((c) => (
                        <td key={`b-${c.key}`} className="whitespace-nowrap px-2 py-2.5 text-right text-[#3a3a3f]">
                          {batting ? formatCell(batting[c.key as keyof typeof batting]) : '—'}
                        </td>
                      ))
                    : null}
                  {showPit
                    ? GAME_PIT_COLS.map((c) => (
                        <td key={`p-${c.key}`} className="whitespace-nowrap px-2 py-2.5 text-right text-[#3a3a3f]">
                          {pitching ? formatCell(pitching[c.key as keyof typeof pitching]) : '—'}
                        </td>
                      ))
                    : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeyStatStrip({ stats }: { stats: KeyStat[] }) {
  if (stats.length === 0) return null;
  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      {stats.map((s) => (
        <div key={s.label} className="min-w-[3.5rem]">
          <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa2]">{s.label}</dt>
          <dd className="mt-0.5 text-xl font-black tabular-nums tracking-tight text-[#12324e]">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function tabFromLocation(): TabId {
  if (typeof window === 'undefined') return 'summary';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('tab');
  const fromHash = window.location.hash.replace(/^#/, '');
  return parseTab(fromQuery || fromHash || 'summary');
}

export function PlayerSeasonPage() {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<PlayerDetailResponse | null>(null);
  const [message, setMessage] = useState('That player could not be loaded.');
  const [tab, setTab] = useState<TabId>(tabFromLocation);

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

    const onPop = () => setTab(tabFromLocation());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);

    return () => {
      alive = false;
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const selectTab = useCallback((next: TabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'summary') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', next);
    }
    url.hash = '';
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  const seasonYear = useMemo(() => (data ? seasonYearFromGames(data.games) : new Date().getFullYear()), [data]);

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
  const batOk = hasBattingLine(batting);
  const pitOk = hasPitchingLine(pitching);
  const primaryKeys = batOk && batting ? battingKeyStats(batting) : pitOk && pitching ? pitchingKeyStats(pitching) : [];
  const secondaryKeys = batOk && pitOk && pitching ? pitchingKeyStats(pitching) : [];
  const subline = [
    player.jersey_number != null ? `#${player.jersey_number}` : null,
    player.pos || null,
  ]
    .filter(Boolean)
    .join(' ');
  const gradQuiet = player.grad_year ? `’${String(player.grad_year).slice(-2)}` : null;

  return (
    <div className="grid gap-0">
      {/* oxlint-disable-next-line next/no-html-link-for-pages */}
      <a href="/baseball/stats" className="mb-3 text-[12px] font-bold text-[#6e6e73] hover:text-[#12324e]">
        ← Stats
      </a>

      <header className="rounded-2xl border border-[#dde7f0] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <img
            src="/brand/baseball/413-shield-96.png"
            alt=""
            width={48}
            height={48}
            className="mt-0.5 h-12 w-12 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-[#12324e] sm:text-3xl">{player.name}</h1>
              <span className="rounded-full bg-[#12324e] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
                {seasonYear}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-[#6e6e73]">
              {subline || '4:13 Baseball'}
              {gradQuiet ? <span className="ml-2 font-medium text-[#9a9aa2]">Class {gradQuiet}</span> : null}
            </p>
            <KeyStatStrip stats={primaryKeys} />
            {secondaryKeys.length > 0 ? (
              <div className="mt-2 border-t border-[#eef1f5] pt-2">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9a9aa2]">Pitching</p>
                <KeyStatStrip stats={secondaryKeys} />
              </div>
            ) : null}
            {!batOk && !pitOk ? (
              <p className="mt-3 text-sm text-[#6e6e73]">No season lines yet — stats appear after the first box score.</p>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        aria-label="Player sections"
        className="sticky top-0 z-20 -mx-3 mt-4 border-b border-[#dde7f0] bg-[#f5f7fa]/95 px-3 backdrop-blur-sm sm:-mx-4 sm:px-4"
      >
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'shrink-0 border-b-2 border-[#12324e] px-3 py-2.5 text-[13px] font-extrabold text-[#12324e]'
                    : 'shrink-0 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-bold text-[#6e6e73] hover:text-[#12324e]'
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-4 grid gap-4">
        {tab === 'summary' ? (
          <>
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Last Games</h2>
                {games.length > SUMMARY_LAST_GAMES ? (
                  <button
                    type="button"
                    onClick={() => selectTab('gamelog')}
                    className="text-[12px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
                  >
                    Full game log
                  </button>
                ) : null}
              </div>
              <GameLogTable games={games} mode="compact" />
            </section>

            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Season snapshot</h2>
                <button
                  type="button"
                  onClick={() => selectTab('stats')}
                  className="text-[12px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
                >
                  Full stats
                </button>
              </div>
              {batOk && batting ? (
                <StatTable
                  title={`${seasonYear} Batting`}
                  cols={BAT_COLS}
                  row={batting as unknown as Record<string, unknown>}
                />
              ) : (
                <EmptyCard
                  title="No batting lines yet"
                  body="Season batting appears after the first uploaded box score with this player."
                />
              )}
              {pitOk && pitching ? (
                <div className="mt-3">
                  <StatTable
                    title={`${seasonYear} Pitching`}
                    cols={PIT_COLS}
                    row={pitching as unknown as Record<string, unknown>}
                  />
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {tab === 'gamelog' ? (
          <section>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Game Log</h2>
            <GameLogTable games={games} mode="full" />
          </section>
        ) : null}

        {tab === 'stats' ? (
          <section className="grid gap-3">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Season Stats</h2>
            {batOk && batting ? (
              <StatTable
                title={`${seasonYear} Batting`}
                cols={BAT_COLS}
                row={batting as unknown as Record<string, unknown>}
              />
            ) : (
              <EmptyCard
                title="No batting lines yet"
                body="Season batting appears after the first uploaded box score with this player."
              />
            )}
            {pitOk && pitching ? (
              <StatTable
                title={`${seasonYear} Pitching`}
                cols={PIT_COLS}
                row={pitching as unknown as Record<string, unknown>}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
