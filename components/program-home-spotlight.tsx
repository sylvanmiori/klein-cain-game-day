import publication from '../config/publication.json';
import liveScore from '../public/live-score.json';
import { HomeMatchupCard } from './home-matchup-card';
import { type LiveScore } from './live-score-card';
import {
  type Edition,
  apDate,
  editionPath,
  gameDayLong,
  hasPreviewContent,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

type RecapLink = {
  href: string;
  headline: string;
  dateLabel: string;
};

export function ProgramHomeSpotlight({
  featured,
  previewHref,
  recap,
}: {
  featured: Edition;
  previewHref: string;
  recap: RecapLink | null;
}) {
  const opponent = opponentOf(featured, publication.schoolName);
  const autoFacts = [rankFact(featured), predictionFact(featured, publication.schoolName), weatherFact(featured)]
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);
  const facts = [...featured.scheduledFacts, ...autoFacts].slice(0, 4);
  const showPreview = hasPreviewContent(featured) && !featured.finalScore;

  return (
    <div className="home-stack">
      <article className="home-spotlight">
        <div
          className="home-spotlight-art"
          style={{ backgroundImage: `url(${sitePath('/hero-helmet.jpg')})` }}
          aria-hidden="true"
        />
        <div className="home-spotlight-scrim" aria-hidden="true" />
        <div className="home-spotlight-copy">
          <p className="home-kicker">Next game</p>
          <h2>
            {publication.schoolName} vs. {opponent.name}
          </h2>
          <p className="home-spotlight-meta">
            Week {featured.week} · District 15-6A
          </p>
          <ul className="home-spotlight-details">
            <li>
              <IconCalendar />
              {gameDayLong(featured.date, publication.timezone)}
            </li>
            <li>
              <IconClock />
              {featured.kickoff}
            </li>
            <li>
              <IconPin />
              {featured.venue}
            </li>
          </ul>
          {showPreview && (
            <a className="home-spotlight-cta" href={previewHref}>
              Game Preview →
            </a>
          )}
        </div>
      </article>

      <HomeMatchupCard
        initialScore={liveScore as LiveScore}
        editionDate={featured.date}
        kickoff={featured.kickoff}
        venue={featured.venue}
        home={featured.home}
        away={featured.away}
        scheduledFacts={facts}
        previewHref={previewHref}
      />

      {recap && (
        <article className="home-recap">
          <div className="home-recap-head">
            <p className="home-kicker">Latest recap</p>
            <time dateTime={recap.dateLabel}>{recap.dateLabel}</time>
          </div>
          <div className="home-recap-body">
            <div>
              <h3>{recap.headline}</h3>
              <a href={recap.href}>Read the full report →</a>
            </div>
            <img src={sitePath('/og.png')} alt="" />
          </div>
        </article>
      )}
    </div>
  );
}

export function buildRecapLink(edition: Edition | null): RecapLink | null {
  if (!edition?.final) return null;
  return {
    href: sitePath(editionPath(edition)),
    headline: edition.final.headline,
    dateLabel: apDate(edition.date, true),
  };
}
