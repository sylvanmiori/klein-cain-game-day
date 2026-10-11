import type { LiveBracketGame, LiveBracketSnapshot, ScheduleGame } from './types';
import { normalizeOpponent, opponentsMatch } from './opponent-match.mjs';

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

function normalizeField(field?: string | null): string {
  return (field ?? '')
    .replace(/^(GAME RECAP|PLAY BY PLAY)\s*\|\s*/i, '')
    .trim()
    .toLowerCase();
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

function scheduleMatchesBracket(scheduleGame: ScheduleGame, bracketGame: LiveBracketGame): boolean {
  if (scheduleGame.date && bracketGame.date && scheduleGame.date !== bracketGame.date) {
    return false;
  }
  if (scheduleGame.time && bracketGame.time) {
    if (normalizeBracketTime(scheduleGame.time) !== normalizeBracketTime(bracketGame.time)) {
      return false;
    }
  }
  if (scheduleGame.field && bracketGame.field) {
    if (normalizeField(scheduleGame.field) !== normalizeField(bracketGame.field)) {
      return false;
    }
  }

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

/**
 * Match a schedule row to exactly one live bracket game (date/time/field +
 * opponent, with 4:13 on the other side). Rejects ambiguous doubleheaders.
 */
export function findBracketGameForSchedule(
  scheduleGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  bracketGames: LiveBracketGame[],
): LiveBracketGame | null {
  const matches = bracketGames.filter((game) => scheduleMatchesBracket(scheduleGame, game));
  if (matches.length !== 1) return null;

  const scheduledMatches = siblingScheduleGames.filter((game) =>
    bracketGames.some((candidate) => scheduleMatchesBracket(game, candidate)),
  );
  return scheduledMatches.length === 1 ? matches[0] : null;
}

export function findBracketResult(
  scheduleGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  bracketGames: LiveBracketGame[],
): string | null {
  const match = findBracketGameForSchedule(scheduleGame, siblingScheduleGames, bracketGames);
  return match ? resultFromBracketFor413(scheduleGame, match) : null;
}
