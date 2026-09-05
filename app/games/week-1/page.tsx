import type { Metadata } from 'next';
import { SeasonHub } from '../../../components/season-hub';
import { StaticMatchupCard } from '../../../components/static-matchup-card';
import { sitePath } from '../../../lib/site-path';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Week 1 Final: Klein Cain 42, Humble 41 | Cain Game Day',
  description: 'Quarter-by-quarter score and verified leaders from Klein Cain’s 42–41 win at Humble.',
  openGraph: { title: 'Week 1 Final: Klein Cain 42, Humble 41', description: 'Klein Cain opened 2026 with a one-point road win at Humble.', images: [] },
  twitter: { card: 'summary', title: 'Week 1 Final: Klein Cain 42, Humble 41', description: 'Klein Cain opened 2026 with a one-point road win at Humble.', images: [] },
};

const leaders = [
  { name: 'Jace Hanks', number: '9', role: 'QB · Junior', image: '/players/jace-hanks.jpg', stat: '201 passing yards', detail: '15 of 24 · 2 TD' },
  { name: 'Eyan Johnson', number: '16', role: 'RB / SB · Senior', image: '/players/eyan-johnson.jpg', stat: '110 rushing yards', detail: '11 carries · 1 TD' },
  { name: 'Cooper Karns', number: '10', role: 'WR · Senior', image: '/players/cooper-karns.jpg', stat: '110 receiving yards', detail: '6 catches · 1 TD' },
];

export default function WeekOne() {
  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')}><img src={sitePath('/favicon.png')} alt="" /> CAIN GAME DAY</a>
        <nav aria-label="Site navigation"><a href="#recap">Recap</a><a href="#schedule">Schedule</a><a href={sitePath('/#roster-heading')}>Roster</a></nav>
        <span className="issue">Week 1 · Aug. 27, 2026</span>
      </header>

      <section className="game-overview">
        <div className="preview-title"><h1>2026 Week 1 Final: Klein Cain at Humble</h1><p>August 27, 2026 · Turner Stadium</p></div>
        <StaticMatchupCard
          status="Final"
          statusDetail="Aug. 27, 2026"
          venue="Turner Stadium"
          left={{ name:'Klein Cain', mascot:'Hurricanes', logo:sitePath('/favicon.png'), record:'1–0', score:42 }}
          right={{ name:'Humble', mascot:'Wildcats', logo:sitePath('/humble-logo.png'), record:'0–1', score:41 }}
          facts={[
            { label:'Fourth quarter', value:'Humble outscored Cain 13–7' },
            { label:'Halftime', value:'Tied 21–21' },
            { label:'Total offense', value:'Cain 469 yards' },
            { label:'Box score', value:'MaxPreps', href:'https://www.maxpreps.com/tx/football/game/humble-vs-klein-cain-houston/8-27-2026/?c=6cacfe2c-0c45-46ec-ae5a-27bec2c1411a' },
          ]}
        />
      </section>

      <article>
        <section className="week-recap" id="recap">
          <div><h2>Cain survives the opener, 42–41</h2><p>Klein Cain scored in every quarter and carried a 35–28 lead into the fourth. Humble closed with 13 points, but the Hurricanes held the one-point margin.</p></div>
          <div className="quarter-box" aria-label="Quarter-by-quarter score">
            <div><span>Team</span><span>1</span><span>2</span><span>3</span><span>4</span><b>F</b></div>
            <div><strong>Cain</strong><span>14</span><span>7</span><span>14</span><span>7</span><b>42</b></div>
            <div><strong>Humble</strong><span>7</span><span>14</span><span>7</span><span>13</span><b>41</b></div>
          </div>
        </section>

        <section className="game-leaders">
          <div className="compact-head"><h2>Verified game leaders</h2><p>MaxPreps box score</p></div>
          <div className="leader-grid">
            {leaders.map((leader) => <article className="leader-card" key={leader.name}><img src={sitePath(leader.image)} alt={`${leader.name}, Klein Cain football`} /><div><span>#{leader.number} · {leader.role}</span><h3>{leader.name}</h3><strong>{leader.stat}</strong><p>{leader.detail}</p></div></article>)}
          </div>
        </section>

        <SeasonHub activeDate="2026-08-27" />
        <nav className="edition-switcher" aria-label="Game editions"><span>Week 1</span><a href={sitePath('/')}>Week 2: Oak Ridge →</a><a href={sitePath('/games/week-3')}>Week 3: Tomball →</a></nav>
      </article>

      <footer className="compact-footer"><a className="wordmark" href={sitePath('/')}>CAIN <span>/</span> GAME DAY</a><p>Independent fan publication · Game data from MaxPreps and Dave Campbell’s Texas Football.</p></footer>
    </main>
  );
}
