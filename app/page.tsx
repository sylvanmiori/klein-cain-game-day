import publication from '../config/publication.json';
import { TeamPage } from '../components/team-page';
import { JsonLd, teamJsonLd } from '../components/seo-schema';

const siteUrl = 'https://kleincain.gameday.report/';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    absolute: `${publication.schoolName} Football | 2026 Schedule, Scores & Roster | ${publication.siteName}`,
  },
  description: `The independent coverage hub for ${publication.schoolName} ${publication.schoolMascot} high school football (Houston, TX · District 15-6A). 2026 schedule, live scores, game recaps, stats, roster, and photos.`,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: `${publication.schoolName} Football | 2026 Schedule, Scores & Roster | ${publication.siteName}`,
    description: `2026 schedule, live scores, game recaps, season leaders, and roster for ${publication.schoolName} ${publication.schoolMascot} football.`,
    url: siteUrl,
    siteName: publication.siteName,
    type: 'website' as const,
    images: [
      {
        url: `${siteUrl}og.png`,
        width: 1200,
        height: 630,
        alt: `${publication.schoolName} Hurricanes Football`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: `${publication.schoolName} Football | 2026 Schedule, Scores & Roster | ${publication.siteName}`,
    description: `2026 schedule, live scores, game recaps, season leaders, and roster for ${publication.schoolName} ${publication.schoolMascot} football.`,
    images: [`${siteUrl}og.png`],
  },
};

export default function Home() {
  return (
    <>
      <JsonLd schema={teamJsonLd()} />
      <TeamPage />
    </>
  );
}
