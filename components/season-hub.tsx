import schedule from '../config/season-2026.json';
import program from '../config/program.json';
import { editions, editionPath } from '../lib/edition';
import { sitePath } from '../lib/site-path';

/** Season record derived from recorded results, so it cannot go stale. */
function seasonRecord() {
  let wins = 0;
  let losses = 0;
  for (const game of schedule) {
    const result = 'result' in game ? game.result : '';
    if (typeof result !== 'string' || !result) continue;
    if (result.startsWith('W')) wins += 1;
    if (result.startsWith('L')) losses += 1;
  }
  return `${wins}–${losses}`;
}

const editionLinks = new Map(editions.map((edition) => [edition.date, editionPath(edition)]));

// Noon avoids a timezone shift moving the date across a day boundary.
const atNoon = (date: string) => new Date(`${date}T12:00:00`);
/** Games fall on both Thursdays and Fridays, so the day is worth showing. */
const weekday = (date: string) => atNoon(date).toLocaleDateString('en-US', { weekday: 'short' });
const monthDay = (date: string) => atNoon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Results read "W 42–41". Colour reinforces the letter, it never replaces it. */
function outcome(game: { result?: string }) {
  const result = typeof game.result === 'string' ? game.result : '';
  if (result.startsWith('W')) return 'win';
  if (result.startsWith('L')) return 'loss';
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
                </span>
                <b className={outcome(game)}>{'result' in game && game.result ? game.result : game.kickoff}</b>
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
