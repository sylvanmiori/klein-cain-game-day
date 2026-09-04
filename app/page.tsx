import edition from '../content/current-edition.json';

const sources = [
  ['Official schedule', 'https://www.kleincainathletics.com/sport/football/boys/?tab=schedule'],
  ['MaxPreps — Klein Cain', 'https://www.maxpreps.com/tx/houston/klein-cain-hurricanes/football/'],
  ['MaxPreps — Oak Ridge', 'https://www.maxpreps.com/tx/conroe/oak-ridge-war-eagles/football/'],
  ['Rivals — Earl O’Guinn Jr.', 'https://www.on3.com/rivals/earl-oguinn-jr-286130/'],
  ['Rivals — Finn Walker', 'https://www.on3.com/rivals/finn-walker-285232/'],
  ['Official booster photography', 'https://www.kleincainfootball.org/varsity'],
] as const;

export default function Home() {
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Cain Game Day home">CAIN <span>/</span> GAME DAY</a>
        <p>Independent weekly field notes for Hurricane families</p>
        <a className="issue" href="#archive">ISSUE {edition.issue} · {edition.dateShort}</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-photo" role="img" aria-label="Klein Cain Hurricanes varsity football team" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="kicker">Friday night briefing · {edition.venue}</p>
          <h1>{edition.headline.split(' ').slice(0, 1)}<br />{edition.headline.split(' ').slice(1).join(' ')}</h1>
          <p className="dek">{edition.dek}</p>
        </div>
        <div className="scorebug" aria-label="Matchup details">
          <div><span>OAK RIDGE</span><strong>{edition.away.record}</strong></div>
          <b>AT</b>
          <div className="home"><span>KLEIN CAIN</span><strong>{edition.home.record}</strong></div>
          <p>{edition.kickoff} · KLEIN, TX</p>
        </div>
      </section>

      <section className="snapshot" aria-label="Game snapshot">
        <div><span>MASSEY FORECAST</span><strong>CAIN {edition.prediction.home}</strong><em>{edition.opponent} {edition.prediction.away}</em></div>
        <div><span>WIN CHANCE</span><strong>{edition.prediction.winProbability}%</strong><em>{edition.prediction.source}</em></div>
        <div><span>STATE RANK</span><strong>{edition.home.rank} <small>vs</small> {edition.away.rank}</strong><em>MaxPreps, Sept. 3</em></div>
        <div><span>GAME-NIGHT AIR</span><strong>{edition.weatherLabel}</strong><em>{edition.weatherDetail}</em></div>
      </section>

      <article>
        <section className="opening">
          <p className="section-label">THE READ</p>
          <div>
            <h2>{edition.readHeadline}</h2>
            <p className="byline">BY THE CAIN GAME DAY DESK · UPDATED {edition.updated}</p>
          </div>
          <p>{edition.readBody}</p>
        </section>

        <section className="feature-grid">
          <div className="feature-photo photo-two" role="img" aria-label="Klein Cain varsity football players in purple uniforms" />
          <div className="feature-copy">
            <p className="section-label light">WHY CAIN IS FAVORED</p>
            <h2>The gap is bigger than the records.</h2>
            <p>Both teams are one play from matching records. The wider evidence says otherwise. MaxPreps ranks Cain No. 132 in Texas and Oak Ridge No. 793. Massey’s model lands in the same place, projecting a 44–20 Cain win with an 80 percent win probability.</p>
            <p>There is a warning in the opener: Cain gave up 41 points. A favorite that trades stops for scores leaves the upset door open. The fastest way to shut it is a clean first quarter.</p>
          </div>
        </section>

        <section className="players" id="players">
          <div className="section-head">
            <p className="section-label">PLAYER FILE</p>
            <h2>Six names to know before the band hits the first note.</h2>
          </div>
          <div className="player-grid">
            {edition.players.map((player) => (
              <article className={`player-card ${player.team === 'OAK RIDGE' ? 'red' : ''}`} key={player.name}>
                <div className="player-top"><span>{player.team}</span><b>{player.number}</b></div>
                <h3>{player.name}</h3>
                <p className="role">{player.role}</p>
                <div className="rating"><strong>{player.tag}</strong><span>{player.rating}</span></div>
                <p>{player.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="recruiting">
          <div>
            <p className="section-label light">RECRUITING DESK</p>
            <h2>One committed senior. One rising junior.</h2>
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

        <section className="keys">
          <div className="section-head"><p className="section-label">THREE KEYS</p><h2>How the favorite makes the forecast look smart.</h2></div>
          <ol>
            <li><span>01</span><div><h3>Find No. 88</h3><p>Finn Walker’s length can wreck a slow-developing pass game. Chip him, move the launch point and make Oak Ridge find pressure somewhere else.</p></div></li>
            <li><span>02</span><div><h3>Make the first stop</h3><p>Cain scored 42 last week and still needed every point. One early three-and-out changes the night from a race into a game Cain can dictate.</p></div></li>
            <li><span>03</span><div><h3>Get O’Guinn into space</h3><p>Runs, screens, quick motion: the delivery method matters less than giving Cain’s young playmaker a clean edge and one defender to beat.</p></div></li>
          </ol>
        </section>

        <section className="gameday">
          <div><p className="section-label light">GAME CARD</p><h2>{edition.date}</h2></div>
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
      </article>

      <footer id="archive">
        <div><a className="wordmark" href="#top">CAIN <span>/</span> GAME DAY</a><p>Issue 01 · Oak Ridge · Sept. 4, 2026</p></div>
        <div className="sources"><strong>SOURCES</strong>{sources.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>
        <p className="disclaimer">Independent fan publication. Not affiliated with Klein ISD, Klein Cain High School, Oak Ridge High School, MaxPreps or Rivals. Forecasts are estimates, not guarantees. Team photography via the Klein Cain Football Booster Club.</p>
      </footer>
    </main>
  );
}
