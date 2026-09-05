import type { Metadata } from 'next';
import publication from '../../../config/publication.json';
import { EditionPage } from '../../../components/edition-page';
import { editionMetadata } from '../../../lib/edition-metadata';
import { editions, editionByWeek } from '../../../lib/edition';

export const dynamic = 'force-static';

type Params = { week: string };

/** Only editions that are not the home page get their own /games route. */
export function generateStaticParams(): Params[] {
  return editions.filter((edition) => !edition.current).map((edition) => ({ week: `week-${edition.week}` }));
}

function resolve(week: string) {
  const edition = editionByWeek(Number(week.replace(/^week-/, '')));
  if (!edition) throw new Error(`No edition file matches the route /games/${week}`);
  return edition;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return editionMetadata(resolve((await params).week), publication.siteName);
}

export default async function GameEdition({ params }: { params: Promise<Params> }) {
  return <EditionPage edition={resolve((await params).week)} />;
}
