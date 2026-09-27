import type { Metadata } from 'next';
import { PlayerSeasonPage } from '../../../components/baseball/player-season-page';

export const metadata: Metadata = {
  title: 'Player',
  description: '4:13 Baseball individual player season batting, pitching, and game log.',
};

export default function BaseballPlayerPage() {
  return <PlayerSeasonPage />;
}
