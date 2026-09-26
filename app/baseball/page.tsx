import type { Metadata } from 'next';
import { BaseballRecordStrip } from '../../components/baseball/record-strip';
import { currentWeekend, formatGameDate, loadSchedule } from '../../components/baseball/data';

export const metadata: Metadata = {
  title: {
    absolute: '4:13 Baseball | Game Day Report',
  },
  description:
    '4:13 Baseball 15U travel ball from Spring, TX (2026-2027 season) — this weekend\'s tournament, results, roster, and season stats.',
};

const PG_URL = 'https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027';

export default async function BaseballHome() {
  const schedule = await loadSchedule();
  const window = schedule ? currentWeekend(schedule) : null;

  return (
    <div className="grid gap-5">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-[#12324e] text-white">
        <div className="flex items-center gap-4 p-6">
          <img
            src="/brand/baseball-shield.svg"
            alt="4:13 Baseball shield"
            className="h-20 w-20 shrink-0 rounded-xl bg-white/10 p-1.5"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight">4:13 Baseball</h1>
            <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.18em] text-[#7BAFD4]">
              15U &middot; Spring, TX &middot; 2026&ndash;2027
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-sm leading-relaxed text-[#c8d8e8]">
            Tournament coverage for the 15U travel ball club out of Spring, Texas — schedules, results,
            roster, and box-score stats, all season long.
          </p>
        </div>
      </section>

      {/* This Weekend */}
      <section aria-label="This weekend" className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">This Weekend</p>
        {!schedule || !window || !window.tournament ? (
          <p className="mt-3 text-sm text-[#6e6e73]">Schedule loading &mdash; tournament details coming soon.</p>
        ) : (
          <div className="mt-2">
            <h2 className="text-lg font-extrabold tracking-tight text-[#12324e]">{window.tournament.name}</h2>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {window.tournament.dates}
              {window.tournament.venue ? ` \u00B7 ${window.tournament.venue}` : ''}
              {window.tournament.location ? `, ${window.tournament.location}` : ''}
            </p>
            {window.tournament.notes && <p className="mt-1 text-sm text-[#6e6e73]">{window.tournament.notes}</p>}
            {window.games.length === 0 ? (
              <p className="mt-3 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[#eef1f5]">
                {window.games.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#12324e]">
                        {g.homeAway === 'home' ? 'vs' : g.homeAway === 'away' ? '@' : 'vs'} {g.opponent}{g.opponentRecord ? ` (${g.opponentRecord})` : ''}
                      </p>
                      <p className="text-[12px] text-[#6e6e73]">
                        {formatGameDate(g.date)}
                        {g.time ? ` \u00B7 ${g.time}` : ''}
                        {g.field ? ` \u00B7 ${g.field}` : ''}
                        {g.note ? ` \u00B7 ${g.note}` : ''}
                      </p>
                    </div>
                    {g.result ? (
                      <span className="shrink-0 rounded-md bg-[#12324e] px-2 py-1 text-[12px] font-extrabold text-white tabular-nums">
                        {g.result}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-[#eef5fb] px-2 py-1 text-[12px] font-bold text-[#12324e]">
                        Upcoming
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {window.tournament.pgUrl && (
              <a
                href={window.tournament.pgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-[13px] font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
              >
                View tournament on Perfect Game
              </a>
            )}
          </div>
        )}
      </section>

      {/* Latest result + season record */}
      <BaseballRecordStrip />

      <p className="text-[12px] text-[#8a8a92]">
        Team page on Perfect Game:{' '}
        <a href={PG_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2">
          4:13 Baseball
        </a>
      </p>
    </div>
  );
}
