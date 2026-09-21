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
import { galleryForSlug, photoWithUse } from '../lib/galleries';
import { sitePath } from '../lib/site-path';

type RecapLink = {
  href: string;
  headline: string;
  dateLabel: string;
  thumbSrc: string;
  thumbAlt: string;
  homePhoto: { src: string; alt: string; caption: string } | null;
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
  const heroImageSrc = sitePath(publication.heroNextGameImage ?? '/hero-next-game.jpg');

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
        heroImageSrc={heroImageSrc}
      />

      {recap?.homePhoto && (
        <a className="home-photo" href={recap.href}>
          <img src={sitePath(recap.homePhoto.src)} alt={recap.homePhoto.alt} />
          <span>{recap.homePhoto.caption}</span>
        </a>
      )}

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
            <img src={sitePath(recap.thumbSrc)} alt={recap.thumbAlt} />
          </div>
        </article>
      )}
    </div>
  );
}

export function buildRecapLink(edition: Edition | null): RecapLink | null {
  if (!edition?.final) return null;
  const gallery = galleryForSlug(edition.slug);
  const thumb = photoWithUse(gallery, 'thumb');
  const home = photoWithUse(gallery, 'home');
  const fallbackThumb = edition.gameStats?.playerOfGame?.image
    || (edition.ogImage && edition.ogImage.length > 0 && !edition.ogImage.includes('og.png') ? edition.ogImage : null)
    || '/hero-helmet.jpg';
  return {
    href: sitePath(editionPath(edition)),
    headline: edition.final.headline,
    dateLabel: apDate(edition.date, true),
    thumbSrc: thumb?.src ?? fallbackThumb,
    thumbAlt: thumb?.alt ?? '',
    homePhoto: home ? { src: home.src, alt: home.alt, caption: home.caption } : null,
  };
}
