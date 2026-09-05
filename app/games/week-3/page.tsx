import type { Metadata } from 'next';
import { PlayerReport } from '../../../components/player-report';
import { SeasonHub } from '../../../components/season-hub';
import { StaticMatchupCard } from '../../../components/static-matchup-card';
import { sitePath } from '../../../lib/site-path';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Week 3 Preview: Tomball at Klein Cain | Cain Game Day',
  description: 'An early look at Klein Cain’s Sept. 18 district opener and homecoming game against Tomball.',
  openGraph: { title: 'Week 3 Preview: Tomball at Klein Cain', description: 'Early matchup facts and players to watch for the Sept. 18 district opener.', images: [] },
  twitter: { card: 'summary', title: 'Week 3 Preview: Tomball at Klein Cain', description: 'Early matchup facts and players to watch for the Sept. 18 district opener.', images: [] },
};

const players = [
  { team:'CAIN', number:'9', name:'Jace Hanks', image:sitePath('/players/jace-hanks.jpg'), role:'QB · Junior', tag:'Week 1 passing leader', rating:'201 yards · 2 TD', copy:'Hanks completed 15 of 24 passes in the opener and accounted for 285 total yards. His early efficiency gives Cain a useful counter to Tomball’s run-heavy approach.' },
  { team:'CAIN', number:'16', name:'Eyan Johnson', image:sitePath('/players/eyan-johnson.jpg'), role:'RB / SB · Senior', tag:'10.0 yards per carry', rating:'110 yards · 1 TD', copy:'Johnson needed 11 carries to reach 110 yards against Humble. Tomball opened with five sacks, so Cain’s ability to stay ahead of the chains will matter.' },
  { team:'CAIN', number:'10', name:'Cooper Karns', image:sitePath('/players/cooper-karns.jpg'), role:'WR · Senior', tag:'Week 1 receiving leader', rating:'6 catches · 110 yards', copy:'Karns produced 110 yards and a touchdown in the opener. He gives Hanks an established target when Tomball commits extra bodies to the run.' },
  { team:'TOMBALL', number:'4', name:'Trevon Johnson', image:sitePath('/players/trevon-johnson.jpg'), role:'RB / MLB · Senior', tag:'Opening-week producer', rating:'142 rushing yards', copy:'Johnson led Tomball’s ground game in the 38–0 win over Stratford. The 6-foot, 205-pound senior is the first test for a Cain defense that gave up 41 in Week 1.' },
  { team:'TOMBALL', number:'22', name:'Ian Thomas', image:sitePath('/players/ian-thomas.jpg'), role:'RB · Junior', tag:'Rivals Industry 91.83', rating:'No. 106 national · No. 6 RB', copy:'Thomas had 207 total yards in Tomball’s opener, including 80 receiving. Rivals lists the 2028 back among the top players in his class.' },
  { team:'TOMBALL', number:'38', name:'Andres von der Meden', image:sitePath('/player-placeholder.svg'), role:'K · Senior', tag:'Rivals Industry 80.33', rating:'No. 5 kicker · 2027', copy:'The specialist has a public Rivals rating and gives Tomball another way to turn field position into points. His listed number comes from the 2026 Dave Campbell’s roster.' },
];

export default function WeekThree() {
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')}><img src={sitePath('/favicon.png')} alt="" /> CAIN GAME DAY</a>
        <nav aria-label="Site navigation"><a href="#players">Players</a><a href="#schedule">Schedule</a><a href={sitePath('/#roster-heading')}>Roster</a></nav>
        <span className="issue">Week 3 · Sept. 18, 2026</span>
      </header>

      <section className="game-overview">
        <div className="preview-title"><h1>2026 Week 3 Preview: Tomball at Klein Cain</h1><p>September 18, 2026 · District opener</p></div>
        <StaticMatchupCard
          status="Preview"
          statusDetail="Sept. 18 · 7:00 PM"
          venue="Klein Memorial Stadium"
          left={{ name:'Tomball', mascot:'Cougars', logo:sitePath('/tomball-logo.png'), record:'1–0' }}
          right={{ name:'Klein Cain', mascot:'Hurricanes', logo:sitePath('/favicon.png'), record:'2–0' }}
          facts={[
            { label:'Setting', value:'District opener · Homecoming' },
            { label:'Early Texas rank', value:'Tomball 69 · Cain 132' },
            { label:'Tomball opener', value:'W 38–0 vs Stratford' },
            { label:'Next update', value:'Game day · Sept. 18' },
          ]}
        />
      </section>

      <article>
        <section className="early-read">
          <div><h2>Early read</h2><p>This matchup is two weeks away, and Tomball still plays Cinco Ranch and Klein Forest before coming to Klein Memorial. The numbers below are a starting point. The full forecast, current records and final player list will update on game day.</p></div>
          <dl><div><dt>Cain</dt><dd>43.5 points per game</dd></div><div><dt>Tomball</dt><dd>277 rush yards in opener</dd></div><div><dt>Tomball defense</dt><dd>5 sacks · 0 points allowed</dd></div></dl>
        </section>

        <section className="players" id="players">
          <div className="section-head"><h2>Early players to watch</h2></div>
          <div className="player-grid">{players.map((player) => <PlayerReport player={player} key={player.name} />)}</div>
          <p className="photo-note">Opening-week statistics from MaxPreps. Recruiting ratings from Rivals/On3. This list will be rechecked on game day.</p>
        </section>

        <section className="recruiting">
          <div><h2>Tomball recruiting notes</h2></div>
          <div className="recruit-row"><span className="recruit-no">22</span><div><strong>IAN THOMAS · TOMBALL</strong><p>Rivals Industry rating 91.83 · 2028 running back · No. 106 nationally and No. 6 at the position as of Sept. 5.</p></div><a href="https://www.on3.com/high-school/tomball-tomball-tx-18178/football/roster/" target="_blank" rel="noreferrer">VIEW RIVALS</a></div>
          <div className="recruit-row"><span className="recruit-no">38</span><div><strong>ANDRES VON DER MEDEN · TOMBALL</strong><p>Rivals Industry rating 80.33 · 2027 kicker · listed No. 5 at the position.</p></div><a href="https://www.on3.com/high-school/tomball-tomball-tx-18178/football/roster/" target="_blank" rel="noreferrer">VIEW RIVALS</a></div>
        </section>

        <SeasonHub activeDate="2026-09-18" />
        <nav className="edition-switcher" aria-label="Game editions"><a href={sitePath('/games/week-1')}>Week 1: Humble</a><a href={sitePath('/')}>Week 2: Oak Ridge</a><span>Week 3</span></nav>
      </article>

      <footer className="compact-footer"><a className="wordmark" href={sitePath('/')}>CAIN <span>/</span> GAME DAY</a><p>Independent fan publication · Early information will be rechecked before kickoff.</p></footer>
    </main>
  );
}
