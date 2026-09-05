import schedule from '../config/season-2026.json';
import { sitePath } from '../lib/site-path';

const pastSeasons = [
  ['2025', '4–6'], ['2024', '9–2'], ['2023', '8–4'], ['2022', '10–2'],
  ['2021', '9–3'], ['2020', '8–3'], ['2019', '6–5'], ['2018', '2–8'],
];

const editionLinks: Record<string, string> = {
  '2026-08-27': '/games/week-1',
  '2026-09-04': '/',
  '2026-09-18': '/games/week-3',
};

export function SeasonHub({ activeDate }: { activeDate: string }) {
  return (
    <section className="season-hub" id="schedule" aria-labelledby="schedule-heading">
      <div className="season-card">
        <div className="season-head"><h2 id="schedule-heading">2026 schedule</h2><p>2–0</p></div>
        <ol>
          {schedule.map((game) => {
            const content = <><time dateTime={game.date}>{new Date(`${game.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time><span>{game.home ? 'vs' : 'at'} <strong>{game.opponent}</strong></span><b>{'result' in game && game.result ? game.result : game.kickoff}</b></>;
            return <li className={game.date === activeDate ? 'current' : ''} key={game.date}>{editionLinks[game.date] ? <a href={sitePath(editionLinks[game.date])}>{content}</a> : content}</li>;
          })}
        </ol>
        <p className="district-note">* District 15-6A game</p>
      </div>

      <div className="history-card">
        <h2>Program history</h2>
        <dl className="history-facts">
          <div><dt>Playoff appearances</dt><dd>6</dd></div>
          <div><dt>State titles</dt><dd>0</dd></div>
          <div><dt>Home field</dt><dd>Klein Memorial</dd></div>
          <div><dt>Capacity</dt><dd>8,500</dd></div>
        </dl>
        <h3>Past seasons</h3>
        <ul className="past-seasons">
          {pastSeasons.map(([year, record]) => <li key={year}><span>{year}</span><strong>{record}</strong></li>)}
        </ul>
        <p className="history-source"><a href="https://www.maxpreps.com/tx/houston/klein-cain-hurricanes/football/history/" target="_blank" rel="noreferrer">Season records</a><a href="https://www.texasfootball.com/team/klein-cain-hurricanes" target="_blank" rel="noreferrer">Program data</a></p>
      </div>
    </section>
  );
}
