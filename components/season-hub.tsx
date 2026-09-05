import schedule from '../config/season-2026.json';
import program from '../config/program.json';
import seasonData from '../content/season-data.json';
import { editions, editionPath } from '../lib/edition';
import { sitePath } from '../lib/site-path';

export type GameResult = { outcome: string; us: number; them: number };
const results: Record<string, GameResult> = seasonData.results;

/** Results come from the score feed, so the schedule cannot go stale. */
export function resultFor(date: string): GameResult | null {
  return results[date] ?? null;
}

export function resultLabel(result: GameResult) {
  return `${result.outcome} ${result.us}\u2013${result.them}`;
}

/** Season record derived from those same results. */
export function seasonRecord() {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const game of schedule) {
    const result = resultFor(game.date);
    if (!result) continue;
    if (result.outcome === 'W') wins += 1;
    else if (result.outcome === 'L') losses += 1;
    else ties += 1;
  }
  const base = `${wins}\u2013${losses}`;
  return ties > 0 ? `${base}\u2013${ties}` : base;
}

const editionLinks = new Map(editions.map((edition) => [edition.date, editionPath(edition)]));

// Noon avoids a timezone shift moving the date across a day boundary.
const atNoon = (date: string) => new Date(`${date}T12:00:00`);
/** Games fall on both Thursdays and Fridays, so the day is worth showing. */
const weekday = (date: string) => atNoon(date).toLocaleDateString('en-US', { weekday: 'short' });
const monthDay = (date: string) => atNoon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Opponent records refresh with the rest of the season data. */
const records: Record<string, string> = seasonData.records;
const record = (opponent: string) => records[opponent] ?? '';

/** Colour reinforces the W or L, it never replaces it. */
function outcomeClass(result: GameResult | null) {
  if (result?.outcome === 'W') return 'win';
  if (result?.outcome === 'L') return 'loss';
  return '';
}

export function SeasonHub({ activeDate }: { activeDate: string }) {
  return (
    <section className="season-hub" id="schedule" aria-labelledby="schedule-heading">
      <div className="season-card">
        <div className="season-head">
          <h2 id="schedule-heading">{program.seasonLabel}</h2>
          <p>{seasonRecord()}</p>
        </div>
        <ol>
          {schedule.map((game) => {
            const href = editionLinks.get(game.date);
            const content = (
              <>
                <time dateTime={game.date}>
                  {/* A real space, so the day and date do not run together for
                      screen readers or when the schedule is copied. */}
                  <span className="dow">{weekday(game.date)}</span>{' '}
                  {monthDay(game.date)}
                </time>
                <span>
                  {game.home ? 'vs' : 'at'} <strong>{game.opponent}</strong>
                  {/* A real space, so the text reads "Humble (1–1)" when copied. */}
                  {record(game.opponent) && <>{' '}<small className="opp-record">({record(game.opponent)})</small></>}
                </span>
                <b className={outcomeClass(resultFor(game.date))}>
                  {(() => {
                    const result = resultFor(game.date);
                    return result ? resultLabel(result) : game.kickoff;
                  })()}
                </b>
              </>
            );
            return (
              <li className={game.date === activeDate ? 'current' : ''} key={game.date}>
                {href ? <a href={sitePath(href)}>{content}</a> : content}
              </li>
            );
          })}
        </ol>
        <p className="district-note">{program.districtNote}</p>
      </div>

      <div className="history-card">
        <h2>Program history</h2>
        <dl className="history-facts">
          {program.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <h3>Past seasons</h3>
        <ul className="past-seasons">
          {program.pastSeasons.map((season) => (
            <li key={season.year}>
              <span>{season.year}</span>
              <strong>{season.record}</strong>
            </li>
          ))}
        </ul>
        <p className="history-source">
          {program.links.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </p>
      </div>
    </section>
  );
}
