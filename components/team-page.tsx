import publication from '../config/publication.json';
import schedule from '../config/season-2026.json';
import liveScore from '../public/live-score.json';
import { FinalView, PreviewView } from './edition-page';
import { LiveScoreCard, type LiveScore } from './live-score-card';
import { SeasonHub, seasonRecord } from './season-hub';
import { RosterSection, SeasonStats } from './team-sections';
import { SchoolCoachSection } from './coaching-section';
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
import { coachingMatchup } from '../lib/coaches';
import { sitePath } from '../lib/site-path';

/**
 * The program page: everything that is true all season rather than about one
 * game. Each game keeps its own report; this is where the schedule, the season
 * leaders and the roster live together.
 */
export function TeamPage() {
  // The featured game is whichever edition is current: promotion keeps the
  // latest final through the open week, then moves to the next preview on the
  // Monday of that game's week. Using the live card means the front page
  // carries a live score on game night.
  const featured = currentEdition;
  const stats = latestEditionWithStats();
  const isPreview = Boolean(featured.preview && !featured.final);
  const featuredOpponent = opponentOf(featured, publication.schoolName);
  const featuredMatchup = coachingMatchup(featuredOpponent.name, featuredOpponent.mascot);
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
          {isPreview && featured.preview!.players.length > 0 && <a href="#players">Players</a>}
          {featuredMatchup && <a href="#coaching">Coaches</a>}
          <a href="#schedule">Schedule</a>
          {featured.final && featured.gameStats
            ? <a href="#game-stats">Stats</a>
            : stats && <a href="#stats">Stats</a>}
          <a href="#roster-heading">Roster</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="game-overview" id="top">
        <div className="preview-title">
          <h1>
            {isPreview
              ? featured.pageTitle.replace(/^2026 /, '')
              : `${publication.schoolName} ${publication.schoolMascot}`}
          </h1>
          <p>
            {isPreview
              ? `${featured.dateLong} · ${featured.event || featured.venue}`
              : `${seasonRecord()} · District 15-6A · ${publication.schoolName} High School`}
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

      <article className="program-hub">
        {featured.final && (
          <FinalView final={featured.final} gameStats={featured.gameStats} matchup={featuredMatchup} />
        )}
        {isPreview && <PreviewView edition={featured} preview={featured.preview!} />}

        <SeasonHub activeDate={featured.date} />

        <nav className="edition-switcher" aria-label="Game reports">
          {editions.map((edition) => {
            const label = `Week ${edition.week}: ${opponentOf(edition, publication.schoolName).name}`;
            return edition.date === featured.date
              ? <span key={edition.slug}>{label}</span>
              : <a key={edition.slug} href={sitePath(editionPath(edition))}>{label}</a>;
          })}
        </nav>

        {stats && <SeasonStats edition={stats} note="Season totals" />}

        {!isPreview && <SchoolCoachSection />}

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
