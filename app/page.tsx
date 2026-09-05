import publication from '../config/publication.json';
import { EditionPage } from '../components/edition-page';
import { editionMetadata } from '../lib/edition-metadata';
import { currentEdition } from '../lib/edition';

export const metadata = editionMetadata(currentEdition, publication.siteName);

export default function Home() {
  return <EditionPage edition={currentEdition} />;
}
