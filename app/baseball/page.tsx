import type { Metadata } from 'next';
import { CalendarDays, ChevronRight, Clock, ExternalLink, MapPin } from 'lucide-react';
import { BaseballRecordStrip } from '../../components/baseball/record-strip';
import {
  currentWeekend,
  formatGameDateParts,
  getSeasonRecord,
  loadSchedule,
  mapsSearchUrl,
} from '../../components/baseball/data';

export const metadata: Metadata = {
  title: {
    absolute: '4:13 Baseball | Game Day Report',
  },
  description:
    '4:13 Baseball 15U travel ball from Spring, TX (2026-2027 season) — this weekend\'s tournament, results, roster, and box-score stats.',
};

const PG_URL = 'https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027';

function versusLabel(homeAway?: 'home' | 'away' | 'neutral') {
  if (homeAway === 'away') return '@';
  return 'vs';
}

function weekendDateLabel(dates?: string, startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
    const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate);
    if (a && b) {
      const start = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
      const end = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
      const mon = start.toLocaleDateString('en-US', { month: 'short' });
      const mon2 = end.toLocaleDateString('en-US', { month: 'short' });
      const year = end.getFullYear();
      if (mon === mon2) {
        return `${mon} ${start.getDate()}\u2013${end.getDate()}, ${year}`;
      }
      return `${mon} ${start.getDate()}\u2013${mon2} ${end.getDate()}, ${year}`;
    }
  }
  return dates ?? '';
}

export default async function BaseballHome() {
  const schedule = await loadSchedule();
  const window = schedule ? currentWeekend(schedule) : null;
  const fallbackRecord = schedule ? getSeasonRecord(schedule) : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Hero — one surface, no nested cards */}
      <section className="min-w-0 overflow-hidden rounded-2xl bg-[#12324e] text-white">
        <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
          <img
            src="/brand/baseball/413-shield-192.png"
            alt="4:13 Baseball shield"
            className="h-16 w-16 min-w-0 shrink-0 sm:h-20 sm:w-20"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">4:13 Baseball</h1>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7BAFD4] sm:text-[12px] sm:tracking-[0.18em]">
              15U &middot; Spring, TX &middot; 2026&ndash;2027
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <p className="text-sm leading-relaxed text-[#c8d8e8]">
            Tournament coverage for the 15U travel ball club out of Spring, Texas — schedules, results,
            roster, and box-score stats, all season long.
          </p>
        </div>
      </section>

      {/* This Weekend — single card; hairline rows only, no nested boxes */}
      <section aria-label="This weekend" className="min-w-0 overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">This Weekend</p>
          {!schedule || !window || !window.tournament ? (
            <p className="mt-3 pb-4 text-sm text-[#6e6e73]">Schedule loading &mdash; tournament details coming soon.</p>
          ) : (
            <div className="mt-2">
              <h2 className="text-lg font-extrabold tracking-tight text-[#12324e] sm:text-2xl">
                {window.tournament.name}
              </h2>

              <div className="mt-2.5 flex flex-col gap-1.5 text-sm text-[#6e6e73] sm:mt-3 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5">
                {(window.tournament.dates || window.tournament.startDate) ? (
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                    <span>{weekendDateLabel(window.tournament.dates, window.tournament.startDate, window.tournament.endDate)}</span>
                  </p>
                ) : null}
                {(window.tournament.venue || window.tournament.location || window.tournament.address) && (() => {
                  const maps = mapsSearchUrl(
                    window.tournament.venue,
                    window.tournament.address || window.tournament.location,
                  );
                  const body = (
                    <span className="min-w-0 leading-snug">
                      <span className="font-semibold text-[#12324e]">
                        {window.tournament.venue || window.tournament.location}
                      </span>
                      {window.tournament.address ? (
                        <span className="mt-0.5 block text-[13px] text-[#6e6e73]">
                          {window.tournament.address}
                        </span>
                      ) : window.tournament.venue && window.tournament.location ? (
                        <span className="mt-0.5 block text-[13px] text-[#6e6e73]">
                          {window.tournament.location}
                        </span>
                      ) : null}
                      {maps ? (
                        <span className="mt-0.5 block text-[12px] font-bold text-[#7BAFD4]">
                          Open in Maps
                        </span>
                      ) : null}
                    </span>
                  );
                  return (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7BAFD4]" aria-hidden />
                      {maps ? (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 rounded-sm outline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7BAFD4]"
                        >
                          {body}
                        </a>
                      ) : (
                        body
                      )}
                    </p>
                  );
                })()}
              </div>

              {window.tournament.notes && (
                <p className="mt-2 text-sm text-[#6e6e73]">{window.tournament.notes}</p>
              )}

              {window.games.length === 0 ? (
                <p className="mt-4 pb-4 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>
              ) : (
                <ul className="mt-3">
                  {window.games.map((g, i) => {
                    const parts = formatGameDateParts(g.date);
                    const vs = versusLabel(g.homeAway);
                    const isLast = i === window.games.length - 1;
                    return (
                      <li
                        key={g.id}
                        className={
                          isLast
                            ? 'flex gap-3 py-3.5'
                            : 'flex gap-3 border-b border-[#eef1f5] py-3.5'
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
                            {g.result ? (
                              <span className="shrink-0 rounded-full bg-[#12324e] px-2.5 py-0.5 text-[11px] font-extrabold text-white tabular-nums sm:px-3 sm:py-1 sm:text-[12px]">
                                {g.result}
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-[#e8f3fb] px-2.5 py-0.5 text-[11px] font-bold text-[#12324e] sm:px-3 sm:py-1 sm:text-[12px]">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
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
            className="flex items-center justify-between gap-3 border-t border-[#eef1f5] px-4 py-3 text-[13px] font-bold text-[#12324e] transition-colors hover:bg-[#f7fafc] sm:px-5"
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-[#7BAFD4]" aria-hidden />
              View tournament on Perfect Game
            </span>
            <ChevronRight className="h-4 w-4 text-[#9a9aa2]" aria-hidden />
          </a>
        ) : null}
      </section>

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
