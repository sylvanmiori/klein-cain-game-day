import type { Metadata } from 'next';
import publication from '../../config/publication.json';
import schedule from '../../config/season-2026.json';
import { MatchupCard } from '../../components/matchup-card';
import { SeasonHub } from '../../components/season-hub';
import { RosterSection, SeasonStats } from '../../components/team-sections';
import {
  apDate,
  editionPath,
  editions,
  latestEditionWithStats,
  nextEdition,
  opponentOf,
  predictionFact,
  rankFact,
} from '../../lib/edition';
import { sitePath } from '../../lib/site-path';

export const dynamic = 'force-static';

const siteUrl = process.env.DEPLOY_TARGET === 'cloudflare'
  ? 'https://kleincain.gameday.report/'
  : 'https://sylvanmiori.github.io/klein-cain-game-day/';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${publication.schoolName} ${publication.schoolMascot} football | ${publication.siteName}`,
  description: `Schedule, results, season leaders and roster for ${publication.schoolName} football.`,
  openGraph: {
    title: `${publication.schoolName} ${publication.schoolMascot} football`,
    description: `Schedule, results, season leaders and roster for ${publication.schoolName} football.`,
    url: `${siteUrl}team`,
    siteName: publication.siteName,
    type: 'website',
  },
};

/** Record from recorded results, matching the season card. */
function seasonRecord() {
  let wins = 0;
  let losses = 0;
  for (const game of schedule) {
    const result = 'result' in game ? game.result : '';
    if (typeof result !== 'string') continue;
    if (result.startsWith('W')) wins += 1;
    if (result.startsWith('L')) losses += 1;
  }
  return `${wins}–${losses}`;
}

/**
 * The program page: everything that is true all season rather than about one
 * game. Each game keeps its own report; this is where the schedule, the season
 * leaders and the roster live together.
 */
export default function TeamPage() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: publication.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const next = nextEdition(today);
  const stats = latestEditionWithStats();
  // The same facts the game page shows, capped at the row's four columns.
  const facts = next
    ? [
      ...next.scheduledFacts,
      ...[rankFact(next), predictionFact(next, publication.schoolName)].filter(
        (fact): fact is NonNullable<typeof fact> => fact !== null,
      ),
    ].slice(0, 4)
    : [];

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

        {next && (
          <MatchupCard
            status="scheduled"
            statusLabel="Next game"
            statusDetail={<span>{`${apDate(next.date)} · ${next.kickoff}`}</span>}
            dateShort={next.dateShort}
            kickoff={next.kickoff}
            venue={next.venue}
            away={next.away}
            home={next.home}
            facts={facts}
          />
        )}
      </section>

      <article>
        <SeasonHub activeDate={next?.date ?? ''} />

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
