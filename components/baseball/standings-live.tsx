'use client';

import { useEffect, useState } from 'react';
import type {
  BaseballPoolStandingsFallback,
  LiveStandingsSnapshot,
  StandingsPool,
  StandingsTeam,
} from './types';

const OUR_TEAM = '4:13 Baseball';

function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '\u2014';
  return pct.toFixed(3);
}

function cell(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  return String(value);
}

function isOurTeam(name: string | null | undefined): boolean {
  return (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === OUR_TEAM.toLowerCase();
}

function PoolTable({ pool }: { pool: StandingsPool }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7BAFD4]">{pool.pool}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eef1f5] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9aa2]">
              <th className="py-2 pr-2 font-extrabold">#</th>
              <th className="py-2 pr-3 font-extrabold">Team</th>
              <th className="px-1.5 py-2 text-center font-extrabold">ST</th>
              <th className="px-1.5 py-2 text-center font-extrabold">PCT</th>
              <th className="px-1.5 py-2 text-center font-extrabold">W</th>
              <th className="px-1.5 py-2 text-center font-extrabold">L</th>
              <th className="px-1.5 py-2 text-center font-extrabold">T</th>
              <th className="px-1.5 py-2 text-center font-extrabold">RA</th>
              <th className="px-1.5 py-2 text-center font-extrabold">RS</th>
            </tr>
          </thead>
          <tbody>
            {pool.teams.map((team: StandingsTeam, i) => {
              const ours = isOurTeam(team.name);
              return (
                <tr
                  key={`${team.name ?? 't'}-${team.seed ?? i}`}
                  className={
                    ours
                      ? 'border-b border-[#dde7f0] bg-[#eef5fb] font-extrabold text-[#12324e]'
                      : 'border-b border-[#eef1f5] text-[#12324e]'
                  }
                >
                  <td className="py-2 pr-2 tabular-nums">{cell(team.seed)}</td>
                  <td className="py-2 pr-3">
                    {team.team_url ? (
                      <a
                        href={team.team_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={ours ? 'underline decoration-[#7BAFD4] decoration-2 underline-offset-2' : 'hover:underline'}
                      >
                        {team.name ?? '\u2014'}
                      </a>
                    ) : (
                      (team.name ?? '\u2014')
                    )}
                  </td>
                  <td className="px-1.5 py-2 text-center">{cell(team.state)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{formatPct(team.pct)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{cell(team.w)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{cell(team.l)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{cell(team.t)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{cell(team.ra)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{cell(team.rs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiveView({ snapshot }: { snapshot: LiveStandingsSnapshot }) {
  const updated = formatUpdated(snapshot.updated_at ?? snapshot.scraped_at);
  return (
    <div className="mt-3 grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {snapshot.tournament && (
          <h2 className="text-base font-extrabold tracking-tight text-[#12324e]">{snapshot.tournament}</h2>
        )}
        {updated && (
          <p className="text-[12px] text-[#6e6e73]">
            Updated {updated} &middot; Source: Perfect Game
          </p>
        )}
      </div>
      {snapshot.pools.map((pool) => (
        <PoolTable key={pool.pool} pool={pool} />
      ))}
      {snapshot.standings_url && (
        <a
          href={snapshot.standings_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          View live standings on Perfect Game
        </a>
      )}
    </div>
  );
}

function FallbackView({ fallback }: { fallback: BaseballPoolStandingsFallback | null }) {
  if (!fallback || fallback.pools.length === 0) {
    return <p className="mt-2 text-sm text-[#6e6e73]">Pool standings not posted yet.</p>;
  }
  return (
    <div className="mt-3 grid gap-5">
      {fallback.tournamentName && (
        <h2 className="text-base font-extrabold tracking-tight text-[#12324e]">{fallback.tournamentName}</h2>
      )}
      {fallback.pools.map((pool) => (
        <PoolTable key={pool.pool} pool={pool} />
      ))}
      {fallback.standingsUrl && (
        <a
          href={fallback.standingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          View live standings on Perfect Game
        </a>
      )}
    </div>
  );
}

export function StandingsLive({ fallback }: { fallback: BaseballPoolStandingsFallback | null }) {
  const [live, setLive] = useState<LiveStandingsSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/standings', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<LiveStandingsSnapshot>;
      })
      .then((data) => {
        if (!alive) return;
        if (data && Array.isArray(data.pools) && data.pools.length > 0) setLive(data);
      })
      .catch(() => {
        // Fallback (build-time schedule.json pool_standings) keeps rendering.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="min-w-0 rounded-2xl border border-[#dde7f0] bg-white p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Pool Standings</p>
      {live ? <LiveView snapshot={live} /> : <FallbackView fallback={fallback} />}
    </section>
  );
}
