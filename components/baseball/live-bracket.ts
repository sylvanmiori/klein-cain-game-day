import type {
  ApiGame,
  BaseballSchedule,
  LiveBracketGame,
  LiveBracketSnapshot,
  ScheduleGame,
  SeasonRecord,
} from './types';
import { findSavedGame, normalizeOpponent, opponentsMatch } from './opponent-match.mjs';

let bracketRequest: Promise<LiveBracketSnapshot> | null = null;

/** Share one in-flight bracket fetch across Home + Schedule widgets. */
export function loadLiveBracket(): Promise<LiveBracketSnapshot> {
  if (!bracketRequest) {
    const request = fetch('/api/baseball/bracket', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<LiveBracketSnapshot>;
      })
      .then(
        (snapshot) => {
          bracketRequest = null;
          return snapshot;
        },
        (error) => {
          bracketRequest = null;
          throw error;
        },
      );
    bracketRequest = request;
  }
  return bracketRequest;
}

export function flattenBracketGames(snapshot: LiveBracketSnapshot | null | undefined): LiveBracketGame[] {
  if (!snapshot || !Array.isArray(snapshot.tiers)) return [];
  return snapshot.tiers.flatMap((tier) => tier.games ?? []);
}

export function parsePgGameId(url?: string | null): string | null {
  const m = /gameid=(\d+)/i.exec(url ?? '');
  return m?.[1] ?? null;
}

export function normalizeBracketTime(time?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec((time ?? '').trim());
  if (!m) return (time ?? '').trim().toUpperCase();
  const hour = Number(m[1]);
  const minute = m[2];
  return `${hour}:${minute} ${m[3].toUpperCase()}M`;
}

/** Compare schedule + bracket locations on "Field N" (ignores venue / recap prefixes). */
export function normalizeFieldKey(field?: string | null): string | null {
  let text = (field ?? '').trim();
  if (!text) return null;
  text = text.replace(/^(GAME RECAP|PLAY BY PLAY)\s*\|\s*/gi, '');
  if (text.includes('\u00B7')) {
    const parts = text.split('\u00B7').map((part) => part.trim());
    text = parts[parts.length - 1] ?? text;
  }
  const match = /\bfield\s*(\d+)\b/i.exec(text);
  if (match) return `field ${match[1]}`;
  return text.toLowerCase();
}

export function isOurTeamName(name: string | null | undefined): boolean {
  const n = normalizeOpponent(name ?? '');
  return n.includes('413BASEBALL') || n === '413';
}

/** True when PG posted both scores or named a winner. */
export function isBracketGameFinal(game: LiveBracketGame): boolean {
  if (game.winner === 'home' || game.winner === 'away') return true;
  return Number.isInteger(game.home.score) && Number.isInteger(game.away.score);
}

/** W/L/T from 4:13's perspective for a finished bracket game. */
export function resultFromBracketFor413(
  scheduleGame: ScheduleGame,
  bracketGame: LiveBracketGame,
): string | null {
  if (!isBracketGameFinal(bracketGame)) return null;
  const homeScore = bracketGame.home.score;
  const awayScore = bracketGame.away.score;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;
  const h = homeScore as number;
  const a = awayScore as number;

  let ourScore: number;
  let theirScore: number;
  if (isOurTeamName(bracketGame.home.name)) {
    ourScore = h;
    theirScore = a;
  } else if (isOurTeamName(bracketGame.away.name)) {
    ourScore = a;
    theirScore = h;
  } else if (opponentsMatch(scheduleGame.opponent, bracketGame.home.name ?? '')) {
    ourScore = a;
    theirScore = h;
  } else if (opponentsMatch(scheduleGame.opponent, bracketGame.away.name ?? '')) {
    ourScore = h;
    theirScore = a;
  } else {
    return null;
  }

  if (ourScore > theirScore) return `W ${ourScore}-${theirScore}`;
  if (ourScore < theirScore) return `L ${ourScore}-${theirScore}`;
  return `T ${ourScore}-${theirScore}`;
}

function teamsMatchSchedule(
  scheduleGame: ScheduleGame,
  bracketGame: LiveBracketGame,
): boolean {
  const homeIsUs = isOurTeamName(bracketGame.home.name);
  const awayIsUs = isOurTeamName(bracketGame.away.name);
  if (homeIsUs && opponentsMatch(scheduleGame.opponent, bracketGame.away.name ?? '')) {
    return true;
  }
  if (awayIsUs && opponentsMatch(scheduleGame.opponent, bracketGame.home.name ?? '')) {
    return true;
  }

  const homeOpp = opponentsMatch(scheduleGame.opponent, bracketGame.home.name ?? '');
  const awayOpp = opponentsMatch(scheduleGame.opponent, bracketGame.away.name ?? '');
  if (homeOpp && !awayOpp) return true;
  if (awayOpp && !homeOpp) return true;
  return false;
}

export function scheduleMatchesBracket(scheduleGame: ScheduleGame, bracketGame: LiveBracketGame): boolean {
  const schedulePgId = parsePgGameId(scheduleGame.diamondkastUrl);
  const bracketPgId = bracketGame.pg_game_id ?? null;
  if (schedulePgId && bracketPgId && schedulePgId === bracketPgId) {
    return teamsMatchSchedule(scheduleGame, bracketGame);
  }

  if (scheduleGame.date && bracketGame.date && scheduleGame.date !== bracketGame.date) {
    return false;
  }
  if (scheduleGame.time && bracketGame.time) {
    if (normalizeBracketTime(scheduleGame.time) !== normalizeBracketTime(bracketGame.time)) {
      return false;
    }
  }
  const scheduleField = normalizeFieldKey(scheduleGame.field);
  const bracketField = normalizeFieldKey(bracketGame.field);
  if (scheduleField && bracketField && scheduleField !== bracketField) {
    return false;
  }

  return teamsMatchSchedule(scheduleGame, bracketGame);
}

/**
 * Match a schedule row to one live bracket game (PG game id, or date/time/field +
 * opponent with 4:13 on the other side). Rejects only true collisions: two schedule
 * rows tied to the same bracket game, or one row matching multiple bracket games.
 */
export function findBracketGameForSchedule(
  scheduleGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  bracketGames: LiveBracketGame[],
): LiveBracketGame | null {
  const schedulePgId = parsePgGameId(scheduleGame.diamondkastUrl);
  if (schedulePgId) {
    const byGameId = bracketGames.filter((game) => {
      const bracketPgId = game.pg_game_id ?? null;
      return bracketPgId === schedulePgId && teamsMatchSchedule(scheduleGame, game);
    });
    if (byGameId.length === 1) return byGameId[0];
    if (byGameId.length > 1) return null;
  }

  const matches = bracketGames.filter((game) => scheduleMatchesBracket(scheduleGame, game));
  if (matches.length !== 1) return null;

  const matched = matches[0];
  const scheduleRowsForBracket = siblingScheduleGames.filter((row) =>
    scheduleMatchesBracket(row, matched),
  );
  if (scheduleRowsForBracket.length > 1) return null;

  return matched;
}

export function findBracketResult(
  scheduleGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  bracketGames: LiveBracketGame[],
): string | null {
  const match = findBracketGameForSchedule(scheduleGame, siblingScheduleGames, bracketGames);
  return match ? resultFromBracketFor413(scheduleGame, match) : null;
}

const PG_GAME_URL = (id: string) =>
  `https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=${id}`;

function displayField(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const key = normalizeFieldKey(raw);
  if (key?.startsWith('field ')) return `Field ${key.slice(6)}`;
  return raw.replace(/^(GAME RECAP|PLAY BY PLAY)\s*\|\s*/gi, '').trim() || undefined;
}

/** PG feeder placeholders — never list these unless 4:13 is already named on the row. */
export function isBracketPlaceholderName(name: string | null | undefined): boolean {
  const n = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) return true;
  if (/^seed\s*#?\s*\d+$/i.test(n)) return true;
  if (/^winner of game\s*#?\s*\d+/i.test(n)) return true;
  return false;
}

function scheduleTimeSortKey(time?: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec((time ?? '').trim());
  if (!m) return 24 * 60;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'P') h += 12;
  return h * 60 + Number(m[2]);
}

function compareScheduleGames(a: ScheduleGame, b: ScheduleGame): number {
  return a.date.localeCompare(b.date) || scheduleTimeSortKey(a.time) - scheduleTimeSortKey(b.time);
}

/** Same venue·field prefix loadSchedule() applies on multi-park weekends. */
export function applyMultiParkFieldPrefix(games: ScheduleGame[]): ScheduleGame[] {
  const parks = new Set(
    games.map((g) => (g.venue ?? '').trim().toLowerCase()).filter(Boolean),
  );
  if (parks.size <= 1) return games;
  return games.map((g) => {
    if (!g.venue || !g.field || g.field.includes('\u00B7')) return g;
    return { ...g, field: `${g.venue} \u00B7 ${g.field}` };
  });
}

export function bracketGameToScheduleRow(
  bracketGame: LiveBracketGame,
  tournamentId: string,
): ScheduleGame | null {
  const homeUs = isOurTeamName(bracketGame.home.name);
  const awayUs = isOurTeamName(bracketGame.away.name);
  if (!homeUs && !awayUs) return null;

  const opponentTeam = homeUs ? bracketGame.away : bracketGame.home;
  const opponentName = opponentTeam?.name?.trim() ?? '';
  if (!opponentName || isBracketPlaceholderName(opponentName)) return null;
  if (homeUs && isBracketPlaceholderName(bracketGame.away.name)) return null;
  if (awayUs && isBracketPlaceholderName(bracketGame.home.name)) return null;

  const pgId = bracketGame.pg_game_id ?? null;
  const note = bracketGame.round?.trim() || undefined;

  return {
    id: `bracket-gm-${bracketGame.game_number}`,
    date: bracketGame.date ?? '',
    time: bracketGame.time ?? undefined,
    opponent: opponentName,
    homeAway: homeUs ? 'home' : 'away',
    tournamentId,
    venue: bracketGame.venue ?? undefined,
    field: displayField(bracketGame.field),
    note,
    result: null,
    diamondkastUrl: pgId ? PG_GAME_URL(pgId) : undefined,
  };
}

/** Append live bracket games where 4:13 is confirmed and not already on the schedule. */
export function mergeScheduleWithBracketGames(
  scheduleGames: ScheduleGame[],
  snapshot: LiveBracketSnapshot | null | undefined,
  bracketEventId: string | null | undefined,
  tournamentId: string,
): ScheduleGame[] {
  if (!snapshot || !bracketEventId || snapshot.event_id !== bracketEventId) {
    return scheduleGames;
  }

  const bracketGames = flattenBracketGames(snapshot);
  const merged = [...scheduleGames];

  for (const bracketGame of bracketGames) {
    const alreadyListed = scheduleGames.some((row) => scheduleMatchesBracket(row, bracketGame));
    if (alreadyListed) continue;
    const row = bracketGameToScheduleRow(bracketGame, tournamentId);
    if (row) merged.push(row);
  }

  return applyMultiParkFieldPrefix(merged.sort(compareScheduleGames));
}

/** Final W/L/T for one scheduled row — same precedence as `LiveGameResult`. */
export function resolveGameResult(
  game: ScheduleGame,
  siblingGames: ScheduleGame[],
  savedGames: ApiGame[] | null | undefined,
  bracketGames: LiveBracketGame[] | null | undefined,
): string | null {
  const saved = savedGames?.length
    ? findSavedGame(game, siblingGames, savedGames)
    : null;
  if (saved?.result?.trim()) return saved.result.trim();

  const scheduleResult = game.result?.trim();
  if (scheduleResult) return scheduleResult;

  if (bracketGames?.length) {
    const bracketResult = findBracketResult(game, siblingGames, bracketGames);
    if (bracketResult) return bracketResult;
  }

  return null;
}

function resultOutcome(result: string): 'W' | 'L' | 'T' | null {
  const c = result.trim().charAt(0).toUpperCase();
  if (c === 'W' || c === 'L' || c === 'T') return c;
  return null;
}

/** Aggregate wins/losses/ties and the chronologically latest final. */
export function seasonRecordFromResolvedGames(
  entries: Array<{ date: string; time?: string; opponent: string; result: string }>,
): SeasonRecord | null {
  let w = 0;
  let l = 0;
  let t = 0;
  let lastSortKey = '';
  let last: SeasonRecord['last'] = null;

  for (const entry of entries) {
    const outcome = resultOutcome(entry.result);
    if (!outcome) continue;
    if (outcome === 'W') w += 1;
    else if (outcome === 'L') l += 1;
    else t += 1;

    const sortKey = `${entry.date}\0${String(scheduleTimeSortKey(entry.time)).padStart(5, '0')}`;
    if (sortKey >= lastSortKey) {
      lastSortKey = sortKey;
      last = { opponent: entry.opponent, result: entry.result };
    }
  }

  if (w + l + t === 0) return null;
  return { w, l, t, last };
}

/** Season record from the full schedule, D1 box scores, and live bracket finals. */
export function computeSeasonRecord(
  schedule: BaseballSchedule,
  savedGames: ApiGame[] | null | undefined,
  bracketSnapshot: LiveBracketSnapshot | null | undefined,
): SeasonRecord | null {
  const bracketGames = flattenBracketGames(bracketSnapshot);
  const resolved: Array<{ date: string; time?: string; opponent: string; result: string }> = [];

  for (const tournament of schedule.tournaments) {
    const tournamentGames = schedule.games
      .filter((g) => g.tournamentId === tournament.id)
      .sort(compareScheduleGames);
    const siblingGames = mergeScheduleWithBracketGames(
      tournamentGames,
      bracketSnapshot,
      tournament.eventId,
      tournament.id,
    );

    for (const game of siblingGames) {
      const result = resolveGameResult(game, siblingGames, savedGames, bracketGames);
      if (result) {
        resolved.push({
          date: game.date,
          time: game.time,
          opponent: game.opponent,
          result,
        });
      }
    }
  }

  return seasonRecordFromResolvedGames(resolved);
}
