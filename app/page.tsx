import edition from '../content/current-edition.json';
import liveScore from '../public/live-score.json';
import { LiveScoreCard, type LiveScore } from '../components/live-score-card';
import roster from '../content/roster-2026.json';
import { PlayerReport } from '../components/player-report';
import { GameReportTabs } from '../components/game-report-tabs';
import { SeasonHub } from '../components/season-hub';
import { sitePath } from '../lib/site-path';

const sources = [
  ['Official schedule', 'https://www.kleincainathletics.com/sport/football/boys/?tab=schedule'],
  ['MaxPreps — Klein Cain roster', roster.sourceUrl],
  ['MaxPreps — Oak Ridge', 'https://www.maxpreps.com/tx/conroe/oak-ridge-war-eagles/football/'],
  ['Hudl — Oak Ridge roster', 'https://fan.hudl.com/usa/tx/conroe/organization/6632/oak-ridge-high-school/team/17069/boys-varsity-football/roster?ss=2026'],
  ['Oak Ridge High School logo', 'https://orhs.conroeisd.net/'],
  ['Rivals — Earl O’Guinn Jr.', 'https://www.on3.com/rivals/earl-oguinn-jr-286130/'],
  ['Rivals — Finn Walker', 'https://www.on3.com/rivals/finn-walker-285232/'],
  ['Official booster photography', 'https://www.kleincainfootball.org/varsity'],
] as const;

export default function Home() {
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Cain Game Day home"><img src="./favicon.png" alt="" /> CAIN GAME DAY</a>
        <nav aria-label="Site navigation"><a href="#players">Players</a><a href="#schedule">Schedule</a><a href="#roster-heading">Roster</a></nav>
        <a className="issue" href="#archive">Issue {edition.issue} · {edition.dateShort}</a>
      </header>

      <section className="game-overview" id="top">
        <div className="preview-title">
          <h1>2026 Week 2 Final: Oak Ridge at Klein Cain</h1>
          <p>{edition.date} · {edition.event}</p>
        </div>

        <LiveScoreCard
          initialScore={liveScore as LiveScore}
          dateShort={edition.dateShort}
          kickoff={edition.kickoff}
          venue={edition.venue}
          prediction={edition.prediction}
          ranks={{ home: edition.home.rank, away: edition.away.rank }}
          weather={`${edition.weatherLabel} · storms possible earlier`}
        />
      </section>

      <article>
        <GameReportTabs
          initialStatus={(liveScore as LiveScore).status}
          finalView={<>
            <section className="opening final-recap" id="final">
              <div>
                <h2>{edition.readHeadline}</h2>
                <p className="byline">Cain Game Day desk · Updated {edition.updated}</p>
              </div>
              <p>{edition.readBody}</p>
            </section>

            <section className="feature-grid">
              <div className="feature-copy">
                <h2>The prediction was close</h2>
                <p>Massey projected Klein Cain to win 44–20. The Hurricanes won 45–20, one point from the projected score.</p>
                <p>Klein Cain improved to 2–0 and allowed 21 fewer points than it did in the 42–41 opener against Humble.</p>
              </div>
            </section>
          </>}
          previewView={<>
            <section className="players" id="players">
              <div className="section-head">
                <h2>Six players to watch</h2>
              </div>
              <div className="player-grid">
                {edition.players.map((player) => (
                  <PlayerReport player={player} key={player.name} />
                ))}
              </div>
              <p className="photo-note">Player portraits: MaxPreps and public athlete profiles.</p>
            </section>

            <section className="recruiting" id="recruiting">
              <div>
                <h2>Recruiting notes</h2>
              </div>
              <div className="recruit-row">
                <span className="recruit-no">88</span>
                <div><strong>FINN WALKER · OAK RIDGE</strong><p>Three-star defensive lineman · Kansas State commit · Rivals Industry No. 680 nationally, No. 77 at DL, No. 91 in Texas.</p></div>
                <a href="https://www.on3.com/rivals/finn-walker-285232/" target="_blank" rel="noreferrer">VIEW RIVALS ↗</a>
              </div>
              <div className="recruit-row">
                <span className="recruit-no">1</span>
                <div><strong>EARL O’GUINN JR. · KLEIN CAIN</strong><p>Three-star 2028 running back · Rivals Industry No. 726 nationally, No. 56 at RB, No. 91 in Texas. SMU has made contact; LSU is also listed.</p></div>
                <a href="https://www.on3.com/rivals/earl-oguinn-jr-286130/" target="_blank" rel="noreferrer">VIEW RIVALS ↗</a>
              </div>
              <p className="fineprint">Ratings and recruiting status change often. “Unrated” here means no public rating was found in the linked Rivals/On3 data on Sept. 4, not that a player has no college interest.</p>
            </section>

            <section className="keys" id="keys">
              <div className="section-head"><h2>Three keys for Klein Cain</h2></div>
              <ol>
                <li><span>01</span><div><h3>Find No. 88</h3><p>Finn Walker’s length can wreck a slow-developing pass game. Chip him, move the launch point and make Oak Ridge find pressure somewhere else.</p></div></li>
                <li><span>02</span><div><h3>Make the first stop</h3><p>Cain scored 42 last week and still needed every point. One early three-and-out changes the night from a race into a game Cain can dictate.</p></div></li>
                <li><span>03</span><div><h3>Get O’Guinn into space</h3><p>Runs, screens, quick motion: the delivery method matters less than giving Cain’s young playmaker a clean edge and one defender to beat.</p></div></li>
              </ol>
            </section>

            <section className="gameday" id="game-info">
              <div><h2>Game information</h2><p>{edition.date}</p></div>
              <dl>
                <div><dt>KICKOFF</dt><dd>7:00 PM</dd></div>
                <div><dt>SITE</dt><dd>Klein Memorial Stadium</dd></div>
                <div><dt>HOME</dt><dd>Klein Cain Hurricanes</dd></div>
                <div><dt>EVENT</dt><dd>{edition.event}</dd></div>
                <div><dt>CONDITIONS</dt><dd>Warm, humid; monitor storms</dd></div>
              </dl>
              <div className="gameday-links">
                <a href="https://kleinisd.hometownticketing.com/" target="_blank" rel="noreferrer">TICKETS ↗</a>
                <a href="https://www.nfhsnetwork.com/" target="_blank" rel="noreferrer">STREAM INFO ↗</a>
              </div>
            </section>
          </>}
        />

        <SeasonHub activeDate="2026-09-04" />

        <nav className="edition-switcher" aria-label="Game editions">
          <a href={sitePath('/games/week-1')}>← Week 1: Humble</a>
          <span>Week 2</span>
          <a href={sitePath('/games/week-3')}>Week 3: Tomball →</a>
        </nav>

        <section className="roster" aria-labelledby="roster-heading">
          <div className="roster-head">
            <div>
              <h2 id="roster-heading">Klein Cain roster</h2>
            </div>
            <p>{roster.players.length} players · <a href={roster.sourceUrl} target="_blank" rel="noreferrer">{roster.source} roster ↗</a> · updated {roster.updated}</p>
          </div>
          <ol className="roster-list">
            {roster.players.map((player, index) => (
              <li key={`${player.number}-${player.name}-${index}`}>
                <b>{player.number}</b>
                <span><strong>{player.name}</strong><small>{player.position} · {player.class}</small></span>
              </li>
            ))}
          </ol>
          <p className="roster-note">Shared numbers and missing fields are shown as listed by the source.</p>
        </section>

        <figure className="team-photo-footer">
          <img src="./team-2026.jpg" alt="2026 Klein Cain Hurricanes varsity football team" />
          <figcaption>2026 Klein Cain varsity · Klein Cain Football Booster Club</figcaption>
        </figure>
      </article>

      <footer id="archive">
        <div><a className="wordmark" href="#top">CAIN <span>/</span> GAME DAY</a><p>Issue 01 · Oak Ridge · Sept. 4, 2026</p></div>
        <div className="sources"><strong>Sources</strong>{sources.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>
        <p className="disclaimer">Independent fan publication. Not affiliated with Klein ISD, Klein Cain High School, Oak Ridge High School, MaxPreps or Rivals. Forecasts are estimates, not guarantees. Team photography via the Klein Cain Football Booster Club.</p>
      </footer>
    </main>
  );
}
