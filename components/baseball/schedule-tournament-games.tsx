'use client';

import { formatGameDate } from './data';
import { LiveGameResult } from './live-game-result';
import type { ScheduleGame } from './types';
import { useScheduleWithBracket } from './use-schedule-with-bracket';

export function ScheduleTournamentGames({
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
    return <p className="px-5 py-4 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>;
  }

  return (
    <ul className="divide-y divide-[#eef1f5] px-5">
      {merged.map((g) => (
        <li key={g.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#12324e]">
              {g.homeAway === 'home' ? 'vs' : g.homeAway === 'away' ? '@' : 'vs'} {g.opponent}
              {g.opponentRecord ? ` (${g.opponentRecord})` : ''}
            </p>
            <p className="text-[12px] text-[#6e6e73]">
              {formatGameDate(g.date)}
              {g.time ? ` \u00B7 ${g.time}` : ''}
              {g.field ? ` \u00B7 ${g.field}` : ''}
              {g.note ? ` \u00B7 ${g.note}` : ''}
            </p>
          </div>
          <LiveGameResult game={g} siblingGames={merged} style="schedule" />
        </li>
      ))}
    </ul>
  );
}
