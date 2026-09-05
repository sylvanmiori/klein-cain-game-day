import publication from '../config/publication.json';
import schedule from '../config/season-2026.json';
import liveScore from '../public/live-score.json';
import { GameReportTabs } from './game-report-tabs';
import { LiveScoreCard, type LiveScore } from './live-score-card';
import { MatchupCard } from './matchup-card';
import { PlayerReports } from './player-reports';
import { SeasonHub } from './season-hub';
import { RosterSection, SeasonStats } from './team-sections';
import {
  type Edition,
  type Fact,
  type FinalSection,
  type PreviewSection,
  disclaimerLine,
  apDate,
  editionPath,
  editions,
  opponentOf,
  predictionFact,
  rankFact,
  weatherFact,
} from '../lib/edition';
import { sitePath } from '../lib/site-path';

/** The next unplayed game after this one, so "Next" can never go stale. */
function nextGameFact(edition: Edition): Fact | null {
  const next = schedule.find((game) => game.date > edition.date);
  if (!next) return null;
  return { label: 'Next', value: `${next.opponent} · ${apDate(next.date)}` };
}

function PreviewView({ edition, preview }: { edition: Edition; preview: PreviewSection }) {
  return (
    <>
      {preview.intro && (
        <section className="early-read">
          <div>
            <h2>{preview.intro.heading}</h2>
            <p>{preview.intro.body}</p>
          </div>
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
        </section>
      )}

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

/** Season totals for the covered school, never presented as one game's stats. */
function FinalView({ final }: { final: FinalSection }) {
  return (
    <>
      {final.quarters ? (
        <section className="week-recap" id="final">
          <div>
            <h2>{final.headline}</h2>
            {final.byline && <p className="byline">{final.byline}</p>}
            <p>{final.body}</p>
          </div>
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
        </section>
      ) : (
        <section className="opening final-recap" id="final">
          <div>
            <h2>{final.headline}</h2>
            {final.byline && <p className="byline">{final.byline}</p>}
          </div>
          <p>{final.body}</p>
        </section>
      )}

      {final.leaders && (
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
    </>
  );
}

export function EditionPage({ edition }: { edition: Edition }) {
  const { preview, final } = edition;
  const home = sitePath('/');
  const rosterHash = edition.current ? '#roster-heading' : sitePath('/#roster-heading');
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
        finalView={<><FinalView final={final} /><SeasonStats edition={edition} /></>}
        previewView={<PreviewView edition={edition} preview={preview} />}
      />
    )
    : final
      ? <><FinalView final={final} /><SeasonStats edition={edition} /></>
      : preview
        ? <PreviewView edition={edition} preview={preview} />
        : null;

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={edition.current ? '#top' : home} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt="" /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          {preview && preview.players.length > 0 && <a href="#players">Players</a>}
          {final && !(preview && preview.players.length > 0) && <a href="#final">Recap</a>}
          <a href="#schedule">Schedule</a>
          <a href={sitePath('/team')}>Team</a>
          <a href={rosterHash}>Roster</a>
        </nav>
        {edition.current
          ? (
            <a className="issue" href="#archive">
              Issue {edition.issue} · {edition.dateShort}
            </a>
          )
          : (
            <span className="issue">
              Week {edition.week} · {apDate(edition.date, true)}
            </span>
          )}
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

        {edition.current && <RosterSection />}
      </article>

      {edition.current
        ? (
          <footer id="archive">
            <div>
              <a className="wordmark" href="#top">
                {publication.wordmarkParts[0]} <span>/</span> {publication.wordmarkParts[1]}
              </a>
              <p>
                Issue {edition.issue} · {opponentOf(edition, publication.schoolName).name} · {apDate(edition.date, true)}
              </p>
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
        )
        : (
          <footer className="compact-footer">
            <a className="wordmark" href={home}>
              {publication.wordmarkParts[0]} <span>/</span> {publication.wordmarkParts[1]}
            </a>
            <p>{edition.footerNote}</p>
          </footer>
        )}
    </main>
  );
}
