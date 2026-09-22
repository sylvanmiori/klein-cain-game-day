import publication from '../config/publication.json';
import { SeasonHub, seasonRecord } from './season-hub';
import { RosterSection, SeasonStats } from './team-sections';
import { SchoolCoachSection } from './coaching-section';
import { buildRecapLink, ProgramHomeSpotlight } from './program-home-spotlight';
import {
  currentEdition,
  editionPath,
  editions,
  latestEditionWithStats,
  latestFinalEdition,
  nextUpcomingEdition,
  opponentOf,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

/**
 * The program homepage: season record, schedule, links to the latest recap and
 * next preview, and paths into every game report. Full previews and recaps live
 * on `/games/week-<n>` only; promotion still sets which game the live card
 * follows through `currentEdition`.
 */
export function TeamPage() {
  const featured = currentEdition;
  const stats = latestEditionWithStats();
  const next = nextUpcomingEdition();
  const latest = latestFinalEdition();
  const previewHref = next ? sitePath(editionPath(next)) : sitePath(editionPath(featured));
  const recap = latest?.final ? buildRecapLink(latest) : null;

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt={`${publication.schoolName} ${publication.schoolMascot} logo`} /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          <a href="#reports">Reports</a>
          <a href={sitePath('/photos')}>Photos</a>
          <a href="#schedule">Schedule</a>
          {stats && <a href="#stats">Stats</a>}
          <a href="#roster-heading">Roster</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="program-hero" id="top">
        <div className="program-intro">
          <h1>
            {publication.schoolName} {publication.schoolMascot} Football
          </h1>
          <p>{seasonRecord()} · District 15-6A · 2026 season</p>
        </div>

        <ProgramHomeSpotlight featured={featured} previewHref={previewHref} recap={recap} />
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
