import type { Metadata } from 'next';
import { CalendarDays, ChevronRight, Clock, ExternalLink, MapPin } from 'lucide-react';
import { BaseballRecordStrip } from '../../components/baseball/record-strip';
import {
  currentWeekend,
  formatGameDateParts,
  getSeasonRecord,
  loadSchedule,
} from '../../components/baseball/data';

export const metadata: Metadata = {
  title: {
    absolute: '4:13 Baseball | Game Day Report',
  },
  description:
    '4:13 Baseball 15U travel ball from Spring, TX (2026-2027 season) — this weekend\'s tournament, results, roster, and season stats.',
};

const PG_URL = 'https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027';

function versusLabel(homeAway?: 'home' | 'away' | 'neutral') {
  if (homeAway === 'away') return '@';
  return 'vs';
}

export default async function BaseballHome() {
  const schedule = await loadSchedule();
  const window = schedule ? currentWeekend(schedule) : null;
  const fallbackRecord = schedule ? getSeasonRecord(schedule) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section className="min-w-0 overflow-hidden rounded-2xl bg-[#12324e] text-white">
        <div className="flex items-center gap-4 p-6">
          <img
            src="/brand/baseball/413-shield-192.png"
            alt="4:13 Baseball shield"
            className="h-20 w-20 min-w-0 shrink-0"
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
      <section aria-label="This weekend" className="min-w-0 overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <div className="p-5 pb-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">This Weekend</p>
          {!schedule || !window || !window.tournament ? (
            <p className="mt-3 text-sm text-[#6e6e73]">Schedule loading &mdash; tournament details coming soon.</p>
          ) : (
            <div className="mt-2">
              <h2 className="text-xl font-extrabold tracking-tight text-[#12324e] sm:text-2xl">
                {window.tournament.name}
              </h2>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                {window.tournament.dates ? (
                  <p className="flex items-start gap-2 text-sm text-[#6e6e73]">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                    <span>{window.tournament.dates}</span>
                  </p>
                ) : null}
                {(window.tournament.venue || window.tournament.location) && (
                  <p className="flex items-start gap-2 text-sm text-[#6e6e73]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                    <span>
                      {window.tournament.venue || window.tournament.location}
                      {window.tournament.venue && window.tournament.location ? (
                        <>
                          <br />
                          <span className="text-[12px]">{window.tournament.location}</span>
                        </>
                      ) : null}
                    </span>
                  </p>
                )}
              </div>

              {window.tournament.notes && (
                <p className="mt-2 text-sm text-[#6e6e73]">{window.tournament.notes}</p>
              )}

              {window.games.length === 0 ? (
                <p className="mt-4 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#eef1f5] border-t border-[#eef1f5]">
                  {window.games.map((g) => {
                    const parts = formatGameDateParts(g.date);
                    const vs = versusLabel(g.homeAway);
                    return (
                      <li
                        key={g.id}
                        className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#eef1f5] text-[#12324e]">
                            <span className="text-[10px] font-extrabold leading-none tracking-wide">
                              {parts.weekday}
                            </span>
                            <span className="mt-1 text-[11px] font-bold leading-none tracking-wide">
                              {parts.monthDay}
                            </span>
                          </div>

                          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[7.5rem_minmax(0,8.5rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
                            <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#12324e]">
                              <Clock className="h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                              <span>{g.time || 'TBD'}</span>
                            </p>

                            <div className="min-w-0">
                              {g.field ? (
                                <p className="flex items-start gap-1.5 text-sm font-extrabold text-[#12324e]">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                                  <span className="min-w-0">
                                    <span className="block truncate">{g.field}</span>
                                    {g.note ? (
                                      <span className="block text-[12px] font-semibold text-[#6e6e73]">
                                        {g.note}
                                      </span>
                                    ) : null}
                                  </span>
                                </p>
                              ) : g.note ? (
                                <p className="text-[12px] font-semibold text-[#6e6e73]">{g.note}</p>
                              ) : (
                                <p className="text-sm text-[#6e6e73]">Field TBD</p>
                              )}
                            </div>

                            <p className="min-w-0 truncate text-sm font-extrabold text-[#12324e]">
                              {vs} {g.opponent}
                              {g.opponentRecord ? (
                                <span className="font-semibold text-[#6e6e73]"> ({g.opponentRecord})</span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        {g.result ? (
                          <span className="shrink-0 self-start rounded-full bg-[#12324e] px-3 py-1 text-[12px] font-extrabold text-white tabular-nums sm:self-center">
                            {g.result}
                          </span>
                        ) : (
                          <span className="shrink-0 self-start rounded-full bg-[#e8f3fb] px-3 py-1 text-[12px] font-bold text-[#12324e] sm:self-center">
                            Upcoming
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {window?.tournament?.pgUrl ? (
          <a
            href={window.tournament.pgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 border-t border-[#eef1f5] bg-[#fbfcfe] px-5 py-3.5 text-[13px] font-bold text-[#12324e] transition-colors hover:bg-[#f3f7fb]"
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-[#7BAFD4]" aria-hidden />
              View tournament on Perfect Game
            </span>
            <ChevronRight className="h-4 w-4 text-[#9a9aa2]" aria-hidden />
          </a>
        ) : null}
      </section>

      {/* Latest result + season record */}
      <BaseballRecordStrip fallback={fallbackRecord} />

      <p className="text-[12px] text-[#8a8a92]">
        Team page on Perfect Game:{' '}
        <a
          href={PG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#12324e] underline decoration-[#7BAFD4] decoration-2 underline-offset-2"
        >
          4:13 Baseball
        </a>
      </p>
    </div>
  );
}
