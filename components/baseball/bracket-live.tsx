'use client';

import { useEffect, useState } from 'react';
import { formatGameDate } from './data';
import type { BaseballBracket, BracketTeam, LiveBracketGame, LiveBracketSnapshot } from './types';

/** Bracket section for the Schedule page. Renders the live Perfect Game
 *  snapshot from /api/baseball/bracket when the Worker poller has stored one;
 *  otherwise falls back to the build-time bracket.json (server-rendered).
 *  Live data always wins when it loads — last-good snapshot semantics mean a
 *  Perfect Game blip can never blank this section. */

function teamLabel(team: BracketTeam): string {
  const parts = [team.seed, team.name].filter(Boolean);
  return parts.length > 0 ? (parts.join(' ') as string) : 'TBD';
}

/** "Sep 26, 2:45 PM" in Chicago from an ISO timestamp. */
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

function gameMeta(game: LiveBracketGame): string {
  return [game.date ? formatGameDate(game.date) : null, game.time, game.field, game.venue]
    .filter(Boolean)
    .join(' \u00B7 ');
}

function LiveGameRow({ game }: { game: LiveBracketGame }) {
  const home = teamLabel(game.home);
  const away = teamLabel(game.away);
  const hasScores = Number.isInteger(game.home.score) && Number.isInteger(game.away.score);
  const homeWon = game.winner === 'home';
  const awayWon = game.winner === 'away';
  return (
    <li className="min-w-0 py-2.5">
      <p className="text-sm text-[#12324e]">
        {game.round && <span className="font-bold">{game.round}: </span>}
        <span className={homeWon ? 'font-extrabold' : undefined}>{home}</span>
        {hasScores ? (
          <span className="font-extrabold tabular-nums">
            {' '}{game.home.score} &ndash; {game.away.score}{' '}
          </span>
        ) : (
          ' vs '
        )}
        <span className={awayWon ? 'font-extrabold' : undefined}>{away}</span>
      </p>
      {gameMeta(game) && <p className="mt-0.5 text-[12px] text-[#6e6e73]">{gameMeta(game)}</p>}
    </li>
  );
}

function LiveBracketView({ snapshot }: { snapshot: LiveBracketSnapshot }) {
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
      {snapshot.tiers.map((tier) => (
        <div key={tier.tier}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7BAFD4]">{tier.tier}</h3>
          <ul className="mt-1 divide-y divide-[#eef1f5]">
            {tier.games.map((g) => (
              <LiveGameRow key={g.game_number} game={g} />
            ))}
          </ul>
        </div>
      ))}
      {snapshot.bracket_url && (
        <a
          href={snapshot.bracket_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          View live bracket on Perfect Game
        </a>
      )}
    </div>
  );
}

function FallbackBracketView({ bracket }: { bracket: BaseballBracket | null }) {
  if (!bracket || bracket.games.length === 0) {
    return <p className="mt-2 text-sm text-[#6e6e73]">Bracket not posted yet.</p>;
  }
  return (
    <div className="mt-3 grid gap-5">
      {bracket.tournamentName && (
        <h2 className="text-base font-extrabold tracking-tight text-[#12324e]">{bracket.tournamentName}</h2>
      )}
      {Array.from(
        bracket.games.reduce((acc, g) => {
          const tier = g.tier ?? 'Bracket';
          if (!acc.has(tier)) acc.set(tier, []);
          acc.get(tier)!.push(g);
          return acc;
        }, new Map<string, typeof bracket.games>()),
      ).map(([tier, tierGames]) => (
        <div key={tier}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7BAFD4]">{tier}</h3>
          <ul className="mt-1 divide-y divide-[#eef1f5]">
            {tierGames.map((m, i) => (
              <li key={i} className="min-w-0 py-2.5">
                <p className="text-sm font-bold text-[#12324e]">
                  {m.round}: {m.matchup}
                </p>
                <p className="mt-0.5 text-[12px] text-[#6e6e73]">
                  {[m.date ? formatGameDate(m.date) : null, m.time, m.field, m.venue]
                    .filter(Boolean)
                    .join(' \u00B7 ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {bracket.bracketUrl && (
        <a
          href={bracket.bracketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          View live bracket on Perfect Game
        </a>
      )}
    </div>
  );
}

export function BracketLive({ fallback }: { fallback: BaseballBracket | null }) {
  const [live, setLive] = useState<LiveBracketSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/bracket', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<LiveBracketSnapshot>;
      })
      .then((data) => {
        if (!alive) return;
        if (data && Array.isArray(data.tiers) && data.tiers.length > 0) setLive(data);
      })
      .catch(() => {
        // Fallback (build-time bracket.json) keeps rendering.
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="min-w-0 rounded-2xl border border-[#dde7f0] bg-white p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Bracket</p>
      {live ? <LiveBracketView snapshot={live} /> : <FallbackBracketView bracket={fallback} />}
    </section>
  );
}
