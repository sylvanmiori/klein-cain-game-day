import type { Metadata } from 'next';
import { PlayerSeasonPage } from '../../../components/baseball/player-season-page';

export const metadata: Metadata = {
  title: 'Player',
  description: '4:13 Baseball individual player page: season summary, game log, and stats.',
};

export default function BaseballPlayerPage() {
  return <PlayerSeasonPage />;
}
