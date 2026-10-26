import type { Metadata } from 'next';
import publication from '../../config/publication.json';
import roster from '../../content/roster-2026.json';
import { sitePath } from '../../lib/site-path';
import { JsonLd, rosterJsonLd } from '../../components/seo-schema';
import { FooterSocialLinks } from '../../components/footer-social-links';

export const dynamic = 'force-static';

const rosterUrl = 'https://kleincain.gameday.report/roster';

const pageTitle = `Klein Cain Football Roster 2026 | ${publication.siteName}`;
const pageDescription = `The 2026 Klein Cain Hurricanes varsity football roster: every player with jersey number, position, and class for Klein Cain High School in Houston, TX (District 15-6A).`;

export const metadata: Metadata = {
  title: {
    absolute: pageTitle,
  },
  description: pageDescription,
  alternates: {
    canonical: rosterUrl,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: rosterUrl,
    siteName: publication.siteName,
    type: 'website',
    images: [
      {
        url: 'https://kleincain.gameday.report/og.png',
        width: 1200,
        height: 630,
        alt: `${publication.schoolName} Football Roster`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: ['https://kleincain.gameday.report/og.png'],
  },
};

const classCounts = roster.players.reduce<Record<string, number>>((counts, player) => {
  counts[player.class] = (counts[player.class] ?? 0) + 1;
  return counts;
}, {});

const classSummary = ['Sr.', 'Jr.', 'So.', 'Fr.']
  .filter((label) => classCounts[label])
  .map((label) => {
    const word = { 'Sr.': 'seniors', 'Jr.': 'juniors', 'So.': 'sophomores', 'Fr.': 'freshmen' }[label];
    return `${classCounts[label]} ${word}`;
  })
  .join(' · ');

export default function RosterPage() {
  return (
    <main>
      <JsonLd schema={rosterJsonLd()} />
      <header className="masthead">
        <a className="wordmark" href={sitePath('/')} aria-label={`${publication.siteName} home`}>
          <img src={sitePath(publication.schoolLogo)} alt="" /> {publication.wordmark}
        </a>
        <nav aria-label="Site navigation">
          <a href={sitePath('/')}>Home</a>
          <a href={sitePath('/#schedule')}>Schedule</a>
          <a href={sitePath('/photos')}>Photos</a>
        </nav>
        <span className="issue">2026 season</span>
      </header>

      <section className="roster-page">
        <div className="program-intro">
          <h1>Klein Cain Football Roster 2026</h1>
          <p>
            Every player on the 2026 {publication.schoolName} {publication.schoolMascot} varsity roster, with
            jersey numbers, positions, and classes. {publication.schoolName} High School plays in UIL District
            15-6A in Houston, Texas, with home games at Klein Memorial Stadium.
          </p>
        </div>

        <p className="roster-counts">
          {roster.players.length} players · {classSummary}
        </p>

        <ol className="roster-grid">
          {roster.players.map((player, index) => (
            <li className="roster-card" key={`${player.number}-${player.name}-${index}`}>
              <img
                src={sitePath(player.image || '/player-placeholder.svg')}
                alt={`${player.name}, ${publication.schoolName} ${publication.schoolMascot} ${player.position}`}
                loading="lazy"
                decoding="async"
              />
              <div className="roster-card-meta">
                <b>#{player.number}</b>
                <span>
                  <strong>{player.name}</strong>
                  <small>
                    {player.position} · {player.class}
                  </small>
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="roster-note">
          Varsity roster only ·{' '}
          <a href={roster.sourceUrl} target="_blank" rel="noreferrer">
            {roster.source} roster
          </a>{' '}
          · updated {roster.updated} · missing fields are shown as listed by {roster.source}.
        </p>

        <figure className="team-photo-footer">
          <img
            src={sitePath('/team-2026.jpg')}
            alt={`2026 ${publication.schoolName} ${publication.schoolMascot} varsity football team`}
            loading="lazy"
            decoding="async"
          />
          <figcaption>2026 {publication.schoolName} varsity · Klein Cain Football Booster Club</figcaption>
        </figure>

        <p className="roster-more">
          Follow the season on the <a href={sitePath('/')}>program page</a> for the schedule, live scores, and
          game reports, or browse the <a href={sitePath('/photos')}>2026 photo galleries</a>.
        </p>
      </section>

      <footer className="compact-footer">
        <div className="compact-footer-brand">
          <a className="wordmark" href={sitePath('/')}>
            {publication.wordmarkParts[0]} <span>/</span> {publication.wordmarkParts[1]}
          </a>
          <p>Independent fan publication · Photography via Klein Cain Football Booster Club.</p>
        </div>
        <div className="compact-footer-social">
          <FooterSocialLinks />
        </div>
      </footer>
    </main>
  );
}
