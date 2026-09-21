import publication from '../config/publication.json';
import liveScore from '../public/live-score.json';
import { HomeNextGameCard } from './home-next-game-card';
import { type LiveScore } from './live-score-card';
import {
  type Edition,
  apDate,
  editionPath,
  hasPreviewContent,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

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
  const autoFacts = [rankFact(featured), predictionFact(featured, publication.schoolName), weatherFact(featured)]
    .filter((fact): fact is NonNullable<typeof fact> => fact !== null);
  const facts = [...featured.scheduledFacts, ...autoFacts].slice(0, 4);
  const showPreview = hasPreviewContent(featured) && !featured.finalScore;
  const helmetSrc = sitePath(publication.heroHelmetCutout ?? '/silver_cain_football_helmet_cutout.png');

  return (
    <div className="home-stack">
      <HomeNextGameCard
        initialScore={liveScore as LiveScore}
        editionDate={featured.date}
        kickoff={featured.kickoff}
        venue={featured.venue}
        week={featured.week}
        home={featured.home}
        away={featured.away}
        scheduledFacts={facts}
        previewHref={previewHref}
        showPreview={showPreview}
        helmetSrc={helmetSrc}
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
