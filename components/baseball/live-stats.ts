import type { ApiGame, ScheduleGame, StatsResponse } from './types';
import { findSavedGame, opponentsMatch } from './opponent-match.mjs';

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

export {
  findSavedGame,
  normalizeOpponent,
  opponentsMatch,
} from './opponent-match.mjs';

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
