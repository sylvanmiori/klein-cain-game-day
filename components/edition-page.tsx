import { galleryForSlug } from '../lib/galleries';
import type { ReactNode } from 'react';
import { GamePhotoGallery, RecapPhotoStory } from './game-photos';
import { GameHighlightVideo } from './game-video';
import { SocialBuzz } from './tweet-embed';
import publication from '../config/publication.json';
import schedule from '../config/season-2026.json';
import liveScore from '../public/live-score.json';
import { GameReportTabs } from './game-report-tabs';
import { CoachingMatchupSection } from './coaching-section';
import { JsonLd, gameJsonLd } from './seo-schema';
import { LiveScoreCard, type LiveScore } from './live-score-card';
import { MatchupCard } from './matchup-card';
import { PlayerReports } from './player-reports';
import { SeasonHub } from './season-hub';
import { SeasonStats } from './team-sections';
import { XSocialLink } from './x-social-link';
import {
  type Edition,
  type Fact,
  type FinalSection,
  type GameStats,
  type PreviewSection,
  type PullQuote,
  disclaimerLine,
  apDate,
  editionPath,
  editions,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { type CoachingMatchup, coachingMatchup } from '../lib/coaches';
import { sitePath } from '../lib/site-path';

/** The next unplayed game after this one, so "Next" can never go stale. */
function nextGameFact(edition: Edition): Fact | null {
  const next = schedule.find((game) => game.date > edition.date);
  if (!next) return null;
  return { label: 'Next', value: `${next.opponent} · ${apDate(next.date)}` };
}

export function PreviewView({ edition, preview }: { edition: Edition; preview: PreviewSection }) {
  const opponent = opponentOf(edition, publication.schoolName);
  const matchup = coachingMatchup(opponent.name, opponent.mascot);

  return (
    <>
      {preview.intro && (
        <section className="early-read">
          <div>
            <h2>{preview.intro.heading}</h2>
            <EditorialCopy body={preview.intro.body} />
            {[preview.intro.pullQuote, ...(preview.intro.pullQuotes ?? [])]
              .filter((q): q is PullQuote => !!q)
              .map((pq, i) => (
              <figure className="pull-quote" key={`${pq.name}-${i}`}>
                <img src={sitePath(pq.image)} alt={pq.imageAlt} loading="lazy" style={{ objectPosition: pq.imagePosition ?? 'center' }} />
                <blockquote>
                  <p>“{pq.quote}”</p>
                </blockquote>
                <figcaption>
                  <span className="pq-name">{pq.name} · {pq.detail}</span>
                  <span className="pq-note">{pq.note} · Photo: {pq.photoCredit}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {preview.intro.facts.length > 0 && (
          <dl>
            {preview.intro.facts.map((fact) => (
              <div key={fact.label}>
                <dt>
                  {fact.team && <span className={`team-chip ${fact.team}`} aria-hidden="true" />}
                  {fact.label}
                </dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          )}
        </section>
      )}

      {matchup && <CoachingMatchupSection matchup={matchup} />}

      {preview.players.length > 0 && (
        <section className="players" id="players">
          <div className="section-head">
            <h2>{preview.playersHeading}</h2>
          </div>
          <PlayerReports players={preview.players.map((player) => ({ ...player, image: sitePath(player.image) }))} />
          {preview.playersNote && <p className="photo-note">{preview.playersNote}</p>}
        </section>
      )}

      {preview.recruiting && (
        <section className="recruiting" id="recruiting">
          <div>
            <h2>{preview.recruiting.heading}</h2>
          </div>
          {preview.recruiting.rows.map((row) => (
            <div className="recruit-row" key={`${row.number}-${row.name}`}>
              <span className="recruit-no">{row.number}</span>
              <div>
                <strong>
                  {row.name} · {row.team}
                </strong>
                <p>{row.note}</p>
              </div>
              <a href={row.href} target="_blank" rel="noreferrer">
                {row.linkLabel}
              </a>
            </div>
          ))}
          {preview.recruiting.note && <p className="fineprint">{preview.recruiting.note}</p>}
        </section>
      )}

      {preview.keys && (
        <section className="keys" id="keys">
          <div className="section-head">
            <h2>{preview.keys.heading}</h2>
          </div>
          <ol>
            {preview.keys.items.map((key, index) => (
              <li key={key.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{key.title}</h3>
                  <p>{key.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {preview.gameInfo && (
        <section className="gameday" id="game-info">
          <div>
            <h2>{preview.gameInfo.heading}</h2>
            <p>{edition.dateLong}</p>
          </div>
          <dl>
            {preview.gameInfo.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          {preview.gameInfo.links.length > 0 && (
            <div className="gameday-links">
              {preview.gameInfo.links.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function GameStatistics({ stats }: { stats: GameStats }) {
  return (
    <section className="game-statistics" id="game-stats">
      <div className="compact-head">
        <div>
          <h2>Game statistics</h2>
          <p>{stats.team} · game totals</p>
        </div>
        <a href={stats.sourceUrl} target="_blank" rel="noreferrer">MaxPreps box score</a>
      </div>
      <div className="game-stat-layout">
        <dl className="game-total-grid">
          {stats.totals.map((total) => (
            <div key={total.label}>
              <dt>{total.label}</dt>
              <dd>{total.value}</dd>
              <small>{total.detail}</small>
            </div>
          ))}
        </dl>
        <div className="game-leader-list">
          {stats.leaders.map((leader) => (
            <article key={leader.category}>
              <span>{leader.category}</span>
              <div>
                <strong>{leader.name}</strong>
                <small>#{leader.number}</small>
              </div>
              <b>{leader.stat}</b>
              <p>{leader.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerOfGame({ stats }: { stats: GameStats }) {
  const player = stats.playerOfGame;
  return (
    <div className="player-of-game" aria-labelledby="player-of-game-heading">
      <div className="player-of-game-head">
        <div className="player-of-game-visual">
          {player.image ? (
            <img className="player-of-game-photo" src={sitePath(player.image)} alt={`${player.name}, Klein Cain football`} />
          ) : (
            <div className="player-of-game-number" aria-hidden="true">#{player.number}</div>
          )}
          {player.image && <span className="player-of-game-jersey" aria-hidden="true">#{player.number}</span>}
        </div>
        <div className="player-of-game-meta">
          <span>Cain Player of the Game</span>
          <h3 id="player-of-game-heading">{player.name}</h3>
          <strong>{player.headline}</strong>
        </div>
      </div>
      <p className="player-of-game-rationale">{player.rationale}</p>
      {player.model && <small className="player-of-game-model">{player.model}</small>}
    </div>
  );
}

/**
 * Shared renderer for long-form editorial copy (`preview.intro.body`,
 * `final.body`). Convention: blank lines separate paragraphs, and
 * `**double asterisks**` bold key numbers and phrases. Plain text with no
 * markup renders exactly as before. Content is author-written JSON, and
 * React escapes the text segments, so no HTML passes through.
 */
function renderInlineMarkup(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function EditorialCopy({ body, className }: { body: string; className?: string }) {
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={className ?? 'editorial-copy'}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderInlineMarkup(paragraph)}</p>
      ))}
    </div>
  );
}

export function FinalView({
  final,
  gameStats,
  matchup,
  gallery,
}: {
  final: FinalSection;
  gameStats?: GameStats | null;
  matchup?: CoachingMatchup | null;
  gallery?: ReturnType<typeof galleryForSlug>;
}) {
  const hasSidebar = Boolean(final.quarters || gameStats?.playerOfGame);

  return (
    <>
      <section className={`week-recap ${hasSidebar ? 'has-sidebar' : 'no-sidebar'}`} id="final">
        <div className="recap-body-column">
          <h2>{final.headline}</h2>
          {final.byline && <p className="byline">{final.byline}</p>}
          <EditorialCopy body={final.body} className="recap-copy" />
        </div>

        {hasSidebar && (
          <aside className="recap-sidebar" aria-label="Game highlights and player of the game">
            {final.quarters && (
              <div className="quarter-box" aria-label="Quarter-by-quarter score">
                <div>
                  <span>Team</span>
                  {final.quarters.labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                  <b>F</b>
                </div>
                {final.quarters.rows.map((row) => (
                  <div key={row.team}>
                    <strong>{row.team}</strong>
                    {row.scores.map((score, index) => (
                      <span key={`${row.team}-${final.quarters!.labels[index]}`}>{score}</span>
                    ))}
                    <b>{row.total}</b>
                  </div>
                ))}
              </div>
            )}
            {gameStats?.playerOfGame && <PlayerOfGame stats={gameStats} />}
          </aside>
        )}
      </section>

      <RecapPhotoStory gallery={gallery ?? null} />

      {final.socialPosts && final.socialPosts.length > 0 && (
        <SocialBuzz posts={final.socialPosts} />
      )}

      {final.video && <GameHighlightVideo video={final.video} />}

      {gameStats && <GameStatistics stats={gameStats} />}

      {final.leaders && !gameStats && (
        <section className="game-leaders">
          <div className="compact-head">
            <h2>{final.leaders.heading}</h2>
            <p>{final.leaders.source}</p>
          </div>
          <div className="leader-grid">
            {final.leaders.items.map((leader) => (
              <article className="leader-card" key={leader.name}>
                <img src={sitePath(leader.image)} alt={`${leader.name}, ${publication.schoolName} football`} />
                <div>
                  <span>
                    #{leader.number} · {leader.role}
                  </span>
                  <h3>{leader.name}</h3>
                  <strong>{leader.stat}</strong>
                  <p>{leader.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {final.notes.map((note) => (
        <section className="feature-grid" key={note.heading}>
          <div className="feature-copy">
            <h2>{note.heading}</h2>
            {note.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}

      {matchup && <CoachingMatchupSection matchup={matchup} />}
      <GamePhotoGallery gallery={gallery ?? null} />
    </>
  );
}

export function EditionPage({ edition }: { edition: Edition }) {
  const { preview, final } = edition;
  const opponent = opponentOf(edition, publication.schoolName);
  const matchup = coachingMatchup(opponent.name, opponent.mascot);
  const home = sitePath('/');
  const rosterHash = sitePath('/#roster-heading');
  const nextFact = nextGameFact(edition);
  const resultFacts = nextFact ? [...edition.resultFacts, nextFact] : edition.resultFacts;
  // Machine-refreshed facts sit alongside the editorial ones. They appear only
  // once a source has actually supplied them, so a missing forecast shows
  // nothing rather than an empty slot.
  const autoFacts = [
    rankFact(edition),
    predictionFact(edition, publication.schoolName),
    weatherFact(edition),
  ].filter(
    (fact): fact is NonNullable<typeof fact> => fact !== null,
  );
  const scheduledFacts = [...edition.scheduledFacts, ...autoFacts];
  // A result may come from the captured score or from an authored recap.
  const result = edition.finalScore
    ?? (edition.final && edition.final.homeScore !== null
      ? { home: edition.final.homeScore, away: edition.final.awayScore }
      : null);

  const report = preview && final
    ? (
      <GameReportTabs
        initialStatus={edition.current ? (liveScore as LiveScore).status : 'final'}
        finalView={<><FinalView final={final} gameStats={edition.gameStats} matchup={matchup} gallery={galleryForSlug(edition.slug)} /><SeasonStats edition={edition} /></>}
        previewView={<PreviewView edition={edition} preview={preview} />}
      />
    )
    : final
      ? <><FinalView final={final} gameStats={edition.gameStats} matchup={matchup} gallery={galleryForSlug(edition.slug)} /><SeasonStats edition={edition} /></>
      : preview
        ? <PreviewView edition={edition} preview={preview} />
        : null;

  return (
    <main>
      <JsonLd schema={gameJsonLd(edition)} />
      <header className="masthead">
        <a className="wordmark" href={home} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt={`${publication.schoolName} ${publication.schoolMascot} logo`} /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          {preview && preview.players.length > 0 && <a href="#players">Players</a>}
          {matchup && <a href="#coaching">Coaches</a>}
          {final && !(preview && preview.players.length > 0) && <a href="#final">Recap</a>}
          {galleryForSlug(edition.slug) && <a href="#photos">Photos</a>}
          <a href="#schedule">Schedule</a>
          <a href={rosterHash}>Roster</a>
        </nav>
        <a className="issue" href="#archive">
          Week {edition.week} · {apDate(edition.date, true)}
        </a>
      </header>

      <section className="game-overview" id="top">
        <div className="preview-title">
          <h1>{edition.pageTitle}</h1>
          <p>{`${edition.dateLong} · ${edition.event || edition.venue}`}</p>
        </div>

        {edition.current
          ? (
            <LiveScoreCard
              initialScore={liveScore as LiveScore}
              dateShort={edition.dateShort}
              kickoff={edition.kickoff}
              venue={edition.venue}
              home={edition.home}
              away={edition.away}
              featuredTeamName={publication.schoolName}
              scheduledFacts={scheduledFacts}
              resultFacts={resultFacts}
            />
          )
          : (
            <MatchupCard
              status={result ? 'final' : 'scheduled'}
              statusLabel={result ? 'Final' : 'Preview'}
              statusDetail={<span>{result ? apDate(edition.date, true) : `${apDate(edition.date)} · ${edition.kickoff}`}</span>}
              dateShort={edition.dateShort}
              kickoff={edition.kickoff}
              venue={edition.venue}
              away={{ ...edition.away, score: result?.away ?? null }}
              home={{ ...edition.home, score: result?.home ?? null }}
              featuredTeamName={publication.schoolName}
              facts={result ? resultFacts : scheduledFacts}
            />
          )}
      </section>

      <article>
        {report}

        <SeasonHub activeDate={edition.date} />

        <nav className="edition-switcher" aria-label="Game editions">
          {editions.map((other) => {
            const label = `Week ${other.week}: ${opponentOf(other, publication.schoolName).name}`;
            return other.slug === edition.slug
              ? <span key={other.slug}>Week {other.week}</span>
              : <a key={other.slug} href={sitePath(editionPath(other))}>{label}</a>;
          })}
        </nav>

      </article>

      {/* Every game page carries its own sources and its own not-affiliated
          line, because both are specific to the teams on that page. */}
      <footer id="archive">
        <div>
          <a className="wordmark" href={home}>
            {publication.wordmarkParts[0]} <span>/</span> {publication.wordmarkParts[1]}
          </a>
          <p>
            Week {edition.week} · {opponent.name} · {apDate(edition.date, true)}
          </p>
          <div className="footer-social">
            <XSocialLink />
          </div>
        </div>
        <div className="sources">
          <strong>Sources</strong>
          {[...edition.sources, ...publication.sources].map((source) => (
            <a key={source.label} href={source.href} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          ))}
        </div>
        <p className="disclaimer">
          {disclaimerLine(edition)} {publication.forecastNote} {publication.photoCredit}
        </p>
      </footer>
    </main>
  );
}
