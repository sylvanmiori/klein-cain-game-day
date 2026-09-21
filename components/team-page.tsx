import publication from '../config/publication.json';
import liveScore from '../public/live-score.json';
import { LiveScoreCard, type LiveScore } from './live-score-card';
import { SeasonHub, seasonRecord } from './season-hub';
import { RosterSection, SeasonStats } from './team-sections';
import { SchoolCoachSection } from './coaching-section';
import {
  apDate,
  currentEdition,
  editionPath,
  editions,
  hasPreviewContent,
  latestEditionWithStats,
  latestFinalEdition,
  nextUpcomingEdition,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

type ReportLink = {
  href: string;
  kicker: string;
  title: string;
  detail: string;
};

function buildReportLinks(): { primary: ReportLink | null; secondary: ReportLink | null } {
  const next = nextUpcomingEdition();
  const latest = latestFinalEdition();

  let primary: ReportLink | null = null;
  if (next) {
    const opponent = opponentOf(next, publication.schoolName);
    const preview = hasPreviewContent(next) && !next.finalScore;
    primary = {
      href: sitePath(editionPath(next)),
      kicker: next.finalScore ? 'Game report' : preview ? 'Next game preview' : 'Next game',
      title: `Week ${next.week} · ${opponent.name}`,
      detail: `${apDate(next.date)} · ${next.kickoff}`,
    };
  }

  let secondary: ReportLink | null = null;
  if (latest && latest.slug !== next?.slug) {
    secondary = {
      href: sitePath(editionPath(latest)),
      kicker: 'Latest recap',
      title: latest.final?.headline ?? latest.pageTitle.replace(/^2026 /, ''),
      detail: apDate(latest.date, true),
    };
  }

  return { primary, secondary };
}

function ReportLinkCard({ link, variant }: { link: ReportLink; variant: 'primary' | 'secondary' }) {
  return (
    <a className={`program-cta-${variant}`} href={link.href}>
      <span>{link.kicker}</span>
      <strong>{link.title}</strong>
      <small>{link.detail}</small>
    </a>
  );
}

/**
 * The program homepage: season record, schedule, links to the latest recap and
 * next preview, and paths into every game report. Full previews and recaps live
 * on `/games/week-<n>` only; promotion still sets which game the live card
 * follows through `currentEdition`.
 */
export function TeamPage() {
  const featured = currentEdition;
  const stats = latestEditionWithStats();
  const { primary, secondary } = buildReportLinks();
  const autoFacts = [rankFact(featured), predictionFact(featured, publication.schoolName), weatherFact(featured)]
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);
  const facts = [...featured.scheduledFacts, ...autoFacts].slice(0, 4);
  const upcoming = nextUpcomingEdition();
  const resultFacts = featured.finalScore && upcoming && upcoming.slug !== featured.slug
    ? [...featured.resultFacts, { label: 'Next', value: `${opponentOf(upcoming, publication.schoolName).name} · ${apDate(upcoming.date)}` }]
    : featured.resultFacts;

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt="" /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          {(primary || secondary) && <a href="#reports">Reports</a>}
          <a href="#schedule">Schedule</a>
          {stats && <a href="#stats">Stats</a>}
          <a href="#roster-heading">Roster</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="program-hero" id="top">
        <div className="program-intro">
          <h1>
            {publication.schoolName} {publication.schoolMascot}
          </h1>
          <p>{seasonRecord()} · District 15-6A · 2026 season</p>
        </div>

        {(primary || secondary) && (
          <div className="program-cta">
            {primary && <ReportLinkCard link={primary} variant="primary" />}
            {secondary && <ReportLinkCard link={secondary} variant="secondary" />}
          </div>
        )}

        <div className="program-live">
          <p className="program-live-label">
            {featured.finalScore ? 'Latest result' : hasPreviewContent(featured) ? 'This week' : 'Up next'}
          </p>
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
        </div>
      </section>

      <article className="program-hub">
        <SeasonHub activeDate={featured.date} />

        <nav className="edition-switcher" id="reports" aria-label="Game reports">
          {editions.map((edition) => {
            const label = `Week ${edition.week}: ${opponentOf(edition, publication.schoolName).name}`;
            return edition.slug === featured.slug
              ? <span key={edition.slug}>{label}</span>
              : <a key={edition.slug} href={sitePath(editionPath(edition))}>{label}</a>;
          })}
        </nav>

        {stats && <SeasonStats edition={stats} note="Season totals" />}

        <SchoolCoachSection />

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
