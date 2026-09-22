import publication from '../config/publication.json';
import liveScore from '../public/live-score.json';
import { HomeNextGameCard } from './home-next-game-card';
import { type LiveScore } from './live-score-card';
import { CameraIcon } from './game-photos';
import {
  type Edition,
  apDate,
  editionPath,
  hasPreviewContent,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { galleryForSlug, photoWithUse } from '../lib/galleries';
import { sitePath } from '../lib/site-path';

export type RecapFeature = {
  href: string;
  headline: string;
  dateLabel: string;
  weekLabel: string;
  finalScore: string;
  isWin: boolean;
  leadExcerpt: string;
  playerOfGame: {
    name: string;
    headline: string;
  } | null;
  photoCount: number;
  photo: { src: string; alt: string; caption: string } | null;
};

export function ProgramHomeSpotlight({
  featured,
  previewHref,
  recap,
}: {
  featured: Edition;
  previewHref: string;
  recap: RecapFeature | null;
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

      {recap && (
        <article className="home-recap" aria-labelledby="home-recap-title">
          {recap.photo && (
            <div className="home-recap-visual">
              <a href={recap.href} className="home-recap-visual-link" tabIndex={-1} aria-hidden="true">
                <img src={sitePath(recap.photo.src)} alt={recap.photo.alt} />
                <div className="home-recap-visual-scrim" />
              </a>
              {recap.photo.caption && (
                <p className="home-recap-caption">
                  <CameraIcon />
                  <span>{recap.photo.caption}</span>
                </p>
              )}
            </div>
          )}

          <div className="home-recap-body">
            <div>
              <div className="home-recap-head">
                <div className="home-recap-badges">
                  <span className="home-kicker">Latest Recap</span>
                  <span className="home-recap-bullet" aria-hidden="true">·</span>
                  <span className="home-recap-week">{recap.weekLabel}</span>
                  {recap.finalScore && (
                    <span className={`home-recap-result ${recap.isWin ? 'win' : 'loss'}`}>
                      {recap.isWin ? 'W' : 'L'} {recap.finalScore}
                    </span>
                  )}
                </div>
                <time dateTime={recap.dateLabel}>{recap.dateLabel}</time>
              </div>

              <h3 className="home-recap-headline" id="home-recap-title">
                <a href={recap.href}>{recap.headline}</a>
              </h3>

              {recap.leadExcerpt && (
                <p className="home-recap-excerpt">{recap.leadExcerpt}</p>
              )}

              {recap.playerOfGame && (
                <div className="home-recap-performer">
                  <span className="performer-badge">Player of the Game</span>
                  <div className="performer-info">
                    <strong className="performer-name">{recap.playerOfGame.name}</strong>
                    <span className="performer-stat">{recap.playerOfGame.headline}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="home-recap-actions">
              <a href={recap.href} className="home-recap-cta">
                Read full game recap →
              </a>
              {recap.photoCount > 0 && (
                <a href={sitePath('/photos')} className="home-recap-photos-link">
                  View {recap.photoCount} photos →
                </a>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}

function extractLeadSentence(text: string): string {
  if (!text) return '';
  const firstPara = text.split('\n\n')[0].replace(/\*\*/g, '').trim();
  const normalized = firstPara.replace(/\b(Sept|Aug|Oct|Nov|Dec|Jan|Feb|Mar|Apr|Jun|Jul|Jr|Sr|St|vs)\./g, '$1\u2024');
  const match = normalized.match(/^.*?[.!?](?=\s+[A-Z]|$)/);
  if (!match) return firstPara;
  return match[0].replace(/\u2024/g, '.').trim();
}

export function buildRecapLink(edition: Edition | null): RecapFeature | null {
  if (!edition?.final) return null;
  const gallery = galleryForSlug(edition.slug);
  const homePhoto = photoWithUse(gallery, 'home');
  const leadPhoto = photoWithUse(gallery, 'lead');
  const thumbPhoto = photoWithUse(gallery, 'thumb');
  const chosenPhoto = homePhoto || leadPhoto || thumbPhoto;
  const fallbackThumb = edition.gameStats?.playerOfGame?.image
    || (edition.ogImage && edition.ogImage.length > 0 && !edition.ogImage.includes('og.png') ? edition.ogImage : null)
    || '/hero-helmet.jpg';

  const isCainHome = edition.home.name === publication.schoolName;
  const cainScore = isCainHome ? edition.final.homeScore : edition.final.awayScore;
  const oppScore = isCainHome ? edition.final.awayScore : edition.final.homeScore;
  const isWin = (cainScore ?? 0) > (oppScore ?? 0);
  const finalScore = cainScore != null && oppScore != null ? `${cainScore}–${oppScore}` : '';

  const leadExcerpt = extractLeadSentence(edition.final.body);

  const pog = edition.gameStats?.playerOfGame;

  return {
    href: sitePath(editionPath(edition)),
    headline: edition.final.headline,
    dateLabel: apDate(edition.date, true),
    weekLabel: `Week ${edition.week}`,
    finalScore,
    isWin,
    leadExcerpt,
    playerOfGame: pog ? { name: pog.name, headline: pog.headline } : null,
    photoCount: gallery?.photos.length ?? 0,
    photo: chosenPhoto
      ? { src: chosenPhoto.src, alt: chosenPhoto.alt, caption: chosenPhoto.caption }
      : { src: fallbackThumb, alt: edition.final.headline, caption: '' },
  };
}
