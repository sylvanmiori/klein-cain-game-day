import type { Metadata } from 'next';
import { formatGameDate, loadBracket, loadSchedule, mapsSearchUrl } from '../../../components/baseball/data';
import { BracketLive } from '../../../components/baseball/bracket-live';

export const metadata: Metadata = {
  title: 'Schedule',
  description: '4:13 Baseball 15U tournament schedule and game list for the 2026-2027 season.',
};

export default async function BaseballSchedulePage() {
  const schedule = await loadSchedule();
  const bracket = await loadBracket();

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-[#12324e]">Schedule</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">Tournaments and games for the 2026&ndash;2027 season.</p>
      </header>

      {!schedule ? (
        <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
          <p className="text-sm text-[#6e6e73]">Schedule loading &mdash; tournament details coming soon.</p>
        </section>
      ) : (
        <>
          {schedule.tournaments.map((t) => {
            const games = schedule.games
              .filter((g) => g.tournamentId === t.id)
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
            return (
              <section key={t.id} className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
                <div className="bg-[#12324e] px-5 py-4 text-white">
                  <h2 className="text-base font-extrabold tracking-tight">{t.name}</h2>
                  <p className="mt-0.5 text-[13px] text-[#c8d8e8]">{t.dates}</p>
                  {(t.venue || t.address || t.location) && (() => {
                    const maps = mapsSearchUrl(t.venue, t.address || t.location);
                    const line = (
                      <>
                        <span className="font-semibold text-white">{t.venue || t.location}</span>
                        {t.address ? (
                          <span className="mt-0.5 block text-[#c8d8e8]">{t.address}</span>
                        ) : t.venue && t.location ? (
                          <span className="mt-0.5 block text-[#c8d8e8]">{t.location}</span>
                        ) : null}
                        {maps ? (
                          <span className="mt-0.5 block text-[12px] font-bold text-[#7BAFD4]">Open in Maps</span>
                        ) : null}
                      </>
                    );
                    return maps ? (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 block text-[13px] leading-snug hover:underline"
                      >
                        {line}
                      </a>
                    ) : (
                      <p className="mt-1.5 text-[13px] leading-snug text-[#c8d8e8]">{line}</p>
                    );
                  })()}
                  {t.notes && <p className="mt-1 text-[13px] text-[#c8d8e8]">{t.notes}</p>}
                </div>
                {games.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-[#6e6e73]">Game times have not been posted yet.</p>
                ) : (
                  <ul className="divide-y divide-[#eef1f5] px-5">
                    {games.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-3 py-3">
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
              </section>
            );
          })}

          {/* Games not attached to a tournament */}
          {schedule.games.filter((g) => !g.tournamentId).length > 0 && (
            <section className="rounded-2xl border border-[#dde7f0] bg-white px-5 py-4">
              <h2 className="text-base font-extrabold tracking-tight text-[#12324e]">Additional Games</h2>
              <ul className="mt-2 divide-y divide-[#eef1f5]">
                {schedule.games
                  .filter((g) => !g.tournamentId)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#12324e]">
                          {g.homeAway === 'home' ? 'vs' : g.homeAway === 'away' ? '@' : 'vs'} {g.opponent}{g.opponentRecord ? ` (${g.opponentRecord})` : ''}
                        </p>
                        <p className="text-[12px] text-[#6e6e73]">
                          {formatGameDate(g.date)}
                          {g.time ? ` \u00B7 ${g.time}` : ''}
                          {g.venue ? ` \u00B7 ${g.venue}` : ''}
                        </p>
                      </div>
                      {g.result && (
                        <span className="shrink-0 rounded-md bg-[#12324e] px-2 py-1 text-[12px] font-extrabold text-white tabular-nums">
                          {g.result}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Bracket: live Perfect Game snapshot when the Worker poller has one,
          build-time bracket.json fallback otherwise. */}
      <BracketLive fallback={bracket} />
    </div>
  );
}
