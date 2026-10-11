'use client';

import { Clock, MapPin } from 'lucide-react';
import { formatGameDateParts } from './data';
import { LiveGameResult } from './live-game-result';
import type { ScheduleGame } from './types';
import { useScheduleWithBracket } from './use-schedule-with-bracket';

function versusLabel(homeAway?: 'home' | 'away' | 'neutral') {
  if (homeAway === 'away') return '@';
  return 'vs';
}

export function WeekendGamesList({
  games,
  tournamentId,
  bracketEventId,
}: {
  games: ScheduleGame[];
  tournamentId: string;
  bracketEventId?: string;
}) {
  const merged = useScheduleWithBracket(games, tournamentId, bracketEventId);

  if (merged.length === 0) {
    return <p className="mt-4 pb-4 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>;
  }

  return (
    <ul className="mt-3">
      {merged.map((g, i) => {
        const parts = formatGameDateParts(g.date);
        const vs = versusLabel(g.homeAway);
        const isLast = i === merged.length - 1;
        return (
          <li
            key={g.id}
            className={
              isLast ? 'flex gap-3 py-3.5' : 'flex gap-3 border-b border-[#eef1f5] py-3.5'
            }
          >
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-[#f0f3f7] text-[#12324e] sm:h-14 sm:w-14 sm:rounded-xl">
              <span className="text-[10px] font-extrabold leading-none tracking-wide">
                {parts.weekday}
              </span>
              <span className="mt-1 text-[10px] font-bold leading-none tracking-wide sm:text-[11px]">
                {parts.monthDay}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-extrabold text-[#12324e]">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[#7BAFD4] sm:h-4 sm:w-4" aria-hidden />
                  {g.time || 'TBD'}
                </span>
                {g.field ? (
                  <span className="inline-flex items-start gap-1.5 font-extrabold">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7BAFD4] sm:h-4 sm:w-4" aria-hidden />
                    <span className="min-w-0 leading-snug">
                      {g.field}
                      {g.note ? (
                        <span className="font-semibold text-[#6e6e73]"> · {g.note}</span>
                      ) : null}
                    </span>
                  </span>
                ) : g.note ? (
                  <span className="text-[12px] font-semibold text-[#6e6e73]">{g.note}</span>
                ) : null}
              </div>

              <div className="mt-1.5 flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-extrabold leading-snug text-[#12324e] [overflow-wrap:anywhere]">
                  <span className="mr-1">{vs}</span>
                  <span>{g.opponent}</span>
                  {g.opponentRecord ? (
                    <span className="whitespace-nowrap font-semibold text-[#6e6e73]">
                      {' '}
                      ({g.opponentRecord})
                    </span>
                  ) : null}
                </p>
                <LiveGameResult game={g} siblingGames={merged} style="home" />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
