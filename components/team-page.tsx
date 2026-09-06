import publication from '../config/publication.json';
import schedule from '../config/season-2026.json';
import liveScore from '../public/live-score.json';
import { LiveScoreCard, type LiveScore } from './live-score-card';
import { SeasonHub, seasonRecord } from './season-hub';
import { RosterSection, SeasonStats } from './team-sections';
import {
  apDate,
  currentEdition,
  editionPath,
  editions,
  latestEditionWithStats,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

/**
 * The program page: everything that is true all season rather than about one
 * game. Each game keeps its own report; this is where the schedule, the season
 * leaders and the roster live together.
 */
export function TeamPage() {
  // The featured game is whichever edition is current: promotion keeps that on
  // the most recent game for three days, then moves it to the next one. Using
  // the live card means the front page carries a live score on game night.
  const featured = currentEdition;
  const stats = latestEditionWithStats();
  const autoFacts = [rankFact(featured), predictionFact(featured, publication.schoolName), weatherFact(featured)]
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);
  const facts = [...featured.scheduledFacts, ...autoFacts].slice(0, 4);
  // Once the featured game is final, say what is next rather than stopping.
  const upcoming = schedule.find((game) => game.date > featured.date);
  const resultFacts = upcoming
    ? [...featured.resultFacts, { label: 'Next', value: `${upcoming.opponent} · ${apDate(upcoming.date)}` }]
    : featured.resultFacts;

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt="" /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          <a href="#schedule">Schedule</a>
          {stats && <a href="#stats">Stats</a>}
          <a href="#roster-heading">Roster</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="game-overview" id="top">
        <div className="preview-title">
          <h1>
            {publication.schoolName} {publication.schoolMascot}
          </h1>
          <p>
            {seasonRecord()} · District 15-6A · {publication.schoolName} High School
          </p>
        </div>

        <LiveScoreCard
          initialScore={liveScore as LiveScore}
          featuredTeamName={publication.schoolName}
          dateShort={featured.dateShort}
          kickoff={featured.kickoff}
          venue={featured.venue}
          home={featured.home}
          away={featured.away}
          scheduledFacts={facts}
          resultFacts={resultFacts}
        />
      </section>

      <article>
        <SeasonHub activeDate={featured.date} />

        <nav className="edition-switcher" aria-label="Game reports">
          {editions.map((edition) => (
            <a key={edition.slug} href={sitePath(editionPath(edition))}>
              Week {edition.week}: {opponentOf(edition, publication.schoolName).name}
            </a>
          ))}
        </nav>

        {stats && <SeasonStats edition={stats} note="Season totals" />}

        <RosterSection />
      </article>

      <footer className="compact-footer">
        <a className="wordmark" href={sitePath('/')}>
          {publication.wordmarkParts[0]} <span>/</span> {publication.wordmarkParts[1]}
        </a>
        <p>Independent fan publication · Data from MaxPreps and Dave Campbell’s Texas Football.</p>
      </footer>
    </main>
  );
}
