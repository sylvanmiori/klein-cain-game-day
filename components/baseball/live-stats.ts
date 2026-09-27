import type { ApiGame, ScheduleGame, StatsResponse } from './types';

let statsRequest: Promise<StatsResponse> | null = null;

/**
 * Share one fresh stats request across the homepage widgets. This keeps the
 * result pill and record strip in sync without making a request per game row.
 */
export function loadLiveStats(): Promise<StatsResponse> {
  if (!statsRequest) {
    const request = fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatsResponse>;
      })
      .then(
        (stats) => {
          // Share only the in-flight request. A later page mount should always
          // re-check D1 in case a box score was just saved.
          statsRequest = null;
          return stats;
        },
        (error) => {
          // A later navigation can retry a transient failure.
          statsRequest = null;
          throw error;
        },
      );
    statsRequest = request;
  }

  return statsRequest;
}

export function normalizeOpponent(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function opponentsMatch(left: string, right: string): boolean {
  const a = normalizeOpponent(left);
  const b = normalizeOpponent(right);
  if (!a || !b) return false;
  if (a === b) return true;

  // GameChanger often omits Perfect Game's age prefix or coach suffix, e.g.
  // "Offseason Baseball" vs "15U OFFSEASON BASEBALL - WILLIAMS". Only allow
  // containment for a substantial name; the one-to-one checks below still
  // reject any matchup that could refer to more than one game.
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length >= 8 && longer.includes(shorter);
}

/**
 * Find the saved D1 result for one scheduled game. We require the same date
 * and a unique one-to-one opponent match, including the common PG age/coach
 * suffix variation. Showing no result is safer than attaching a score to the
 * wrong game.
 */
export function findSavedGame(
  scheduledGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  savedGames: ApiGame[],
): ApiGame | null {
  const matches = savedGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      opponentsMatch(game.opponent, scheduledGame.opponent) &&
      typeof game.result === 'string' &&
      game.result.trim().length > 0,
  );

  if (matches.length !== 1) return null;

  const scheduledMatches = siblingScheduleGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      opponentsMatch(game.opponent, matches[0].opponent),
  );

  return scheduledMatches.length === 1 ? matches[0] : null;
}

export function findSavedResult(
  scheduledGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  savedGames: ApiGame[],
): string | null {
  return (
    findSavedGame(
      scheduledGame,
      siblingScheduleGames,
      savedGames,
    )?.result?.trim() ?? null
  );
}
