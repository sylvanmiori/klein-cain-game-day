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

/**
 * Find the saved D1 result for one scheduled game. We intentionally require
 * an exact date + normalized-opponent match and reject doubleheader ambiguity;
 * showing no result is safer than attaching a score to the wrong game.
 */
export function findSavedResult(
  scheduledGame: ScheduleGame,
  siblingScheduleGames: ScheduleGame[],
  savedGames: ApiGame[],
): string | null {
  const opponent = normalizeOpponent(scheduledGame.opponent);
  if (!opponent) return null;

  const sameScheduledMatchup = siblingScheduleGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      normalizeOpponent(game.opponent) === opponent,
  );
  if (sameScheduledMatchup.length !== 1) return null;

  const matches = savedGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      normalizeOpponent(game.opponent) === opponent &&
      typeof game.result === 'string' &&
      game.result.trim().length > 0,
  );

  return matches.length === 1 ? matches[0].result!.trim() : null;
}
