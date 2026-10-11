'use client';

import { useEffect, useState } from 'react';
import type { ScheduleGame } from './types';
import { loadLiveBracket, mergeScheduleWithBracketGames } from './live-bracket';

/** Client-side schedule rows plus any confirmed 4:13 bracket games from the live API. */
export function useScheduleWithBracket(
  initialGames: ScheduleGame[],
  tournamentId: string,
  bracketEventId: string | null | undefined,
): ScheduleGame[] {
  const [games, setGames] = useState(initialGames);

  useEffect(() => {
    setGames(initialGames);
  }, [initialGames]);

  useEffect(() => {
    if (!bracketEventId) return;
    let alive = true;
    loadLiveBracket()
      .then((snapshot) => {
        if (!alive) return;
        setGames(mergeScheduleWithBracketGames(initialGames, snapshot, bracketEventId, tournamentId));
      })
      .catch(() => {
        // Keep build-time schedule when the bracket API is unavailable.
      });
    return () => {
      alive = false;
    };
  }, [initialGames, tournamentId, bracketEventId]);

  return games;
}
