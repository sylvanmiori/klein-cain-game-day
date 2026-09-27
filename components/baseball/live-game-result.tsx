'use client';

import { useEffect, useState } from 'react';
import { findSavedResult, loadLiveStats } from './live-stats';
import type { ScheduleGame } from './types';

type ResultStyle = 'home' | 'schedule';

const resultClasses: Record<ResultStyle, string> = {
  home: 'shrink-0 rounded-full bg-[#12324e] px-2.5 py-0.5 text-[11px] font-extrabold text-white tabular-nums sm:px-3 sm:py-1 sm:text-[12px]',
  schedule:
    'shrink-0 rounded-md bg-[#12324e] px-2 py-1 text-[12px] font-extrabold text-white tabular-nums',
};

const upcomingClasses: Record<ResultStyle, string> = {
  home: 'shrink-0 rounded-full bg-[#e8f3fb] px-2.5 py-0.5 text-[11px] font-bold text-[#12324e] sm:px-3 sm:py-1 sm:text-[12px]',
  schedule:
    'shrink-0 rounded-md bg-[#eef5fb] px-2 py-1 text-[12px] font-bold text-[#12324e]',
};

export function LiveGameResult({
  game,
  siblingGames,
  style,
  showUpcoming = true,
}: {
  game: ScheduleGame;
  siblingGames: ScheduleGame[];
  style: ResultStyle;
  showUpcoming?: boolean;
}) {
  const fallback =
    typeof game.result === 'string' && game.result.trim()
      ? game.result.trim()
      : null;
  const [result, setResult] = useState<string | null>(fallback);

  useEffect(() => {
    if (fallback) return;

    let alive = true;
    loadLiveStats()
      .then((stats) => {
        if (!alive || !Array.isArray(stats.games)) return;
        setResult(findSavedResult(game, siblingGames, stats.games));
      })
      .catch(() => {
        // Keep the checked-in schedule fallback when live stats are unavailable.
      });

    return () => {
      alive = false;
    };
  }, [fallback, game, siblingGames]);

  if (result) {
    return (
      <span
        className={resultClasses[style]}
        aria-live="polite"
        aria-label={`Final score ${result}`}
      >
        {result}
      </span>
    );
  }

  if (!showUpcoming) return null;

  return <span className={upcomingClasses[style]}>Upcoming</span>;
}
