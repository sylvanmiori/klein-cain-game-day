import type { ApiGame, ScheduleGame, StatsResponse } from './types';
import { opponentsMatch } from './opponent-match.mjs';

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

export { normalizeOpponent, opponentsMatch } from './opponent-match.mjs';

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
