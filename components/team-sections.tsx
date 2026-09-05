import publication from '../config/publication.json';
import roster from '../content/roster-2026.json';
import { type Edition, apDate, groupedLeaders } from '../lib/edition';
import { sitePath } from '../lib/site-path';

/**
 * Season totals for the covered school. Shared by the team page and the final
 * view of a game, and never presented as one game's box score.
 */
export function SeasonStats({ edition, note }: { edition: Edition; note?: string }) {
  const stats = edition.stats;
  const groups = groupedLeaders(edition);
  if (!stats || groups.length === 0) return null;

  return (
    <section className="stat-leaders" id="stats">
      <div className="compact-head">
        <h2>{publication.schoolName} season leaders</h2>
        <p>
          {note ?? 'Season totals, not this game alone'} ·{' '}
          <a href={stats.sourceUrl} target="_blank" rel="noreferrer">
            {stats.source}
          </a>{' '}
          · entered {apDate(stats.updated.slice(0, 10), true)}
        </p>
      </div>
      <div className="stat-grid">
        {groups.map((group) => (
          <div className="stat-group" key={group.category}>
            <h3>{group.category}</h3>
            <ol>
              {group.rows.map((row) => (
                <li key={`${group.category}-${row.name}`}>
                  <span>
                    {row.name}
                    {row.position && <small>{row.position}</small>}
                  </span>
                  <b>{row.value}</b>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The full roster in small type, with the team photo below it. */
export function RosterSection() {
  return (
    <>
      <section className="roster" aria-labelledby="roster-heading">
        <div className="roster-head">
          <div>
            <h2 id="roster-heading">{publication.schoolName} roster</h2>
          </div>
          <p>
            {roster.players.length} players ·{' '}
            <a href={roster.sourceUrl} target="_blank" rel="noreferrer">
              {roster.source} roster
            </a>{' '}
            · updated {roster.updated}
          </p>
        </div>
        <ol className="roster-list">
          {roster.players.map((player, index) => (
            <li key={`${player.number}-${player.name}-${index}`}>
              <b>{player.number}</b>
              <span>
                <strong>{player.name}</strong>
                <small>
                  {player.position} · {player.class}
                </small>
              </span>
            </li>
          ))}
        </ol>
        <p className="roster-note">Shared numbers and missing fields are shown as listed by the source.</p>
      </section>

      <figure className="team-photo-footer">
        <img
          src={sitePath('/team-2026.jpg')}
          alt={`2026 ${publication.schoolName} ${publication.schoolMascot} varsity football team`}
        />
        <figcaption>2026 {publication.schoolName} varsity · Klein Cain Football Booster Club</figcaption>
      </figure>
    </>
  );
}
