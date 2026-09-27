'use client';

import { useEffect, useState } from 'react';
import { Clock, ExternalLink, MapPin } from 'lucide-react';
import { formatGameDate, mapsSearchUrl } from './data';
import type { BracketTeam, LiveBracketGame, LiveBracketSnapshot, LiveBracketTier } from './types';

/** Home Sunday path: client-fetches /api/baseball/bracket and, when 4:13 is a
 *  named team in a bracket game, shows next game + compact QF→SF→Championship
 *  path. Hides on 404/fail or Seed-only placeholders — never invents data. */

const OUR_TEAM = '4:13 Baseball';

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isPlaceholderName(name: string | null | undefined): boolean {
  const n = normalizeName(name);
  if (!n) return true;
  if (/^seed\s*#?\s*\d+$/i.test(n)) return true;
  if (/^winner of game/i.test(n)) return true;
  return false;
}

/** Prefer matching by team name (contains 4:13 / exact), not pool seed. */
function isOurTeam(name: string | null | undefined): boolean {
  const n = normalizeName(name);
  if (!n || isPlaceholderName(name)) return false;
  if (n.includes('4:13')) return true;
  return n === normalizeName(OUR_TEAM);
}

function teamOnGame(game: LiveBracketGame): 'home' | 'away' | null {
  if (isOurTeam(game.home.name)) return 'home';
  if (isOurTeam(game.away.name)) return 'away';
  return null;
}

function teamLabel(team: BracketTeam): string {
  const parts = [team.seed, team.name].filter(Boolean);
  return parts.length > 0 ? (parts.join(' ') as string) : 'TBD';
}

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

function shortRound(round: string | null | undefined): string {
  const r = (round ?? '').trim().toLowerCase();
  if (r.includes('quarter')) return 'QF';
  if (r.includes('semi')) return 'SF';
  if (r.includes('champ')) return 'Championship';
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'Championship';
  return round?.trim() || 'Game';
}

function gameSortKey(g: LiveBracketGame): number {
  const date = g.date ?? '';
  const time = (g.time ?? '').toLowerCase();
  // Crude AM/PM sort: morning before afternoon; game_number as tiebreak.
  const am = time.includes('am') ? 0 : time.includes('pm') ? 1 : 2;
  return g.game_number + am * 0.01 + (date ? 0 : 1000);
}

function winnerOfRef(name: string | null | undefined): number | null {
  const m = /^winner of game\s*#?\s*(\d+)\s*$/i.exec((name ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** Follow Winner-of-Game feeders from our named games through the same tier. */
function buildPath(tier: LiveBracketTier, seedGames: LiveBracketGame[]): LiveBracketGame[] {
  const path: LiveBracketGame[] = [];
  const seen = new Set<number>();
  const queue = [...seedGames].sort((a, b) => gameSortKey(a) - gameSortKey(b));

  while (queue.length > 0) {
    const g = queue.shift()!;
    if (seen.has(g.game_number)) continue;
    seen.add(g.game_number);
    path.push(g);
    for (const next of tier.games) {
      if (seen.has(next.game_number)) continue;
      const refs = [winnerOfRef(next.home.name), winnerOfRef(next.away.name)];
      if (refs.includes(g.game_number)) {
        queue.push(next);
      }
    }
  }

  // Also include any later game where we are already named (PG filled results).
  for (const g of tier.games) {
    if (seen.has(g.game_number)) continue;
    if (teamOnGame(g)) {
      path.push(g);
      seen.add(g.game_number);
    }
  }

  return path.sort((a, b) => gameSortKey(a) - gameSortKey(b));
}

function pickNextGame(path: LiveBracketGame[]): LiveBracketGame | null {
  for (const g of path) {
    const side = teamOnGame(g);
    if (side) {
      // Named on this game: next if unfinished.
      if (g.winner == null && !(Number.isInteger(g.home.score) && Number.isInteger(g.away.score))) {
        return g;
      }
      continue;
    }
    // Feeder slot not yet named — still our path if we haven't lost earlier.
    if (g.winner == null) return g;
  }
  return path[path.length - 1] ?? null;
}

function opponentFor(game: LiveBracketGame, side: 'home' | 'away' | null): BracketTeam {
  if (side === 'home') return game.away;
  if (side === 'away') return game.home;
  // On a future feeder game we are not named yet; prefer the non-placeholder side
  // if one is known, else away (arbitrary display).
  if (!isPlaceholderName(game.away.name) && isPlaceholderName(game.home.name)) return game.away;
  if (!isPlaceholderName(game.home.name) && isPlaceholderName(game.away.name)) return game.home;
  return game.away;
}


function sideLabel(side: 'home' | 'away' | null): string | null {
  if (side === 'home') return 'Home';
  if (side === 'away') return 'Away';
  return null;
}

/** Venue · Field from the game only — never invent. */
function venueFieldLabel(game: LiveBracketGame): string {
  return [game.venue, game.field].filter(Boolean).join(' · ');
}

/** Compact path location: "Field 8 @ Premier Baseball of Texas" (per-game venue). */
function pathLocationLabel(game: LiveBracketGame): string {
  if (game.field && game.venue) return `${game.field} @ ${game.venue}`;
  return game.field || game.venue || '';
}

function findOurTier(snapshot: LiveBracketSnapshot): {
  tier: LiveBracketTier;
  seedGames: LiveBracketGame[];
} | null {
  for (const tier of snapshot.tiers) {
    const seedGames = tier.games.filter((g) => teamOnGame(g) != null);
    if (seedGames.length > 0) return { tier, seedGames };
  }
  return null;
}

function PathStep({
  game,
  isOurs,
  isNext,
}: {
  game: LiveBracketGame;
  isOurs: boolean;
  isNext: boolean;
}) {
  const loc = pathLocationLabel(game);
  const home = teamLabel(game.home);
  const away = teamLabel(game.away);
  return (
    <li
      className={
        isOurs || isNext
          ? 'rounded-xl border border-[#7BAFD4]/40 bg-[#eef5fb] px-3 py-2.5'
          : 'rounded-xl border border-[#eef1f5] bg-[#f7fafc] px-3 py-2.5'
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7BAFD4]">
          {shortRound(game.round)}
          {game.game_number ? (
            <span className="ml-1.5 font-bold tracking-normal text-[#9a9aa2]">#{game.game_number}</span>
          ) : null}
        </p>
        {game.time ? <p className="text-[12px] font-semibold text-[#6e6e73]">{game.time}</p> : null}
      </div>
      {loc ? (
        <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#6e6e73]">{loc}</p>
      ) : null}
      <p
        className={
          isOurs
            ? 'mt-1 text-sm font-extrabold leading-snug text-[#12324e]'
            : 'mt-1 text-sm font-bold leading-snug text-[#12324e]'
        }
      >
        {home}
        <span className="font-semibold text-[#6e6e73]"> vs </span>
        {away}
      </p>
    </li>
  );
}

function BracketPathView({ snapshot }: { snapshot: LiveBracketSnapshot }) {
  const found = findOurTier(snapshot);
  if (!found) return null;

  const path = buildPath(found.tier, found.seedGames);
  if (path.length === 0) return null;

  const next = pickNextGame(path);
  const nextSide = next ? teamOnGame(next) : null;
  const opponent = next ? opponentFor(next, nextSide) : null;
  const updated = formatUpdated(snapshot.updated_at ?? snapshot.scraped_at);
  const tierName = found.tier.tier || 'Bracket';
  // Title: "Sunday · Silver Bracket" — use weekday from next/path date when present.
  const sundayLabel = (() => {
    const d = next?.date ?? path[0]?.date;
    if (!d) return 'Sunday';
    const parts = formatGameDate(d); // e.g. "Sun, Sep 27"
    const wd = parts.split(',')[0]?.trim();
    return wd || 'Sunday';
  })();

  return (
    <section
      aria-label={`${sundayLabel} bracket path`}
      className="min-w-0 overflow-hidden rounded-2xl border border-[#dde7f0] bg-white"
    >
      <div className="border-b border-[#eef1f5] bg-[#12324e] px-4 py-3.5 sm:px-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7BAFD4]">
          Championship path
        </p>
        <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white sm:text-xl">
          {sundayLabel} · {tierName}
        </h2>
        {updated ? (
          <p className="mt-1 text-[12px] text-[#c8d8e8]">
            Updated {updated} · Source: Perfect Game
          </p>
        ) : null}
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {next && opponent ? (
          <div className="rounded-xl border border-[#dde7f0] bg-[#f7fafc] px-3.5 py-3.5 sm:px-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
              Next game
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-extrabold text-[#12324e]">
              {next.date ? (
                <span>{formatGameDate(next.date)}</span>
              ) : null}
              {next.time ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[#7BAFD4]" aria-hidden />
                  {next.time}
                </span>
              ) : null}
              {sideLabel(nextSide) ? (
                <span className="rounded-md bg-[#12324e] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                  {sideLabel(nextSide)}
                </span>
              ) : null}
            </div>
            {(() => {
              const loc = venueFieldLabel(next);
              const maps = mapsSearchUrl(next.venue || next.field);
              if (!loc && !maps) return null;
              const body = (
                <span className="min-w-0 leading-snug">
                  <span className="font-extrabold text-[#12324e]">{loc}</span>
                  {maps ? (
                    <span className="mt-0.5 block text-[12px] font-bold text-[#7BAFD4]">
                      Open in Maps
                    </span>
                  ) : null}
                </span>
              );
              return (
                <p className="mt-2 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 rounded-sm outline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7BAFD4]"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </p>
              );
            })()}
            <p className="mt-2 text-base font-extrabold leading-snug text-[#12324e]">
              <span className="mr-1.5 font-bold text-[#6e6e73]">
                {nextSide === 'away' ? '@' : 'vs'}
              </span>
              {teamLabel(opponent)}
            </p>
            {next.round ? (
              <p className="mt-1 text-[12px] font-semibold text-[#6e6e73]">
                {next.round}
                {next.game_number ? ` · Game #${next.game_number}` : ''}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
            Path
          </p>
          <ol className="mt-2 grid gap-2">
            {path.map((g) => (
              <PathStep
                key={g.game_number}
                game={g}
                isOurs={teamOnGame(g) != null}
                isNext={next?.game_number === g.game_number}
              />
            ))}
          </ol>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          <a
            href="/baseball/schedule"
            className="text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
          >
            Full bracket on Schedule
          </a>
          {snapshot.bracket_url ? (
            <a
              href={snapshot.bracket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#7BAFD4]" aria-hidden />
              Perfect Game bracket
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function HomeBracketPath() {
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
        // Hide section on failure — do not invent.
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!live) return null;
  if (!findOurTier(live)) return null;
  return <BracketPathView snapshot={live} />;
}
