import publication from '../config/publication.json';
import { TeamPage } from '../components/team-page';

const siteUrl = process.env.DEPLOY_TARGET === 'cloudflare'
  ? 'https://kleincain.gameday.report/'
  : 'https://sylvanmiori.github.io/klein-cain-game-day/';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: `${publication.schoolName} ${publication.schoolMascot} football | ${publication.siteName}`,
  description: `Schedule, results, season leaders and roster for ${publication.schoolName} football.`,
  openGraph: {
    title: `${publication.schoolName} ${publication.schoolMascot} football`,
    description: `Schedule, results, season leaders and roster for ${publication.schoolName} football.`,
    url: siteUrl,
    siteName: publication.siteName,
    type: 'website' as const,
  },
};

export default function Home() {
  return <TeamPage />;
}
