import type { Metadata } from 'next';
import { GameBoxScore } from '../../../components/baseball/game-box-score';

export const metadata: Metadata = {
  title: 'Game Box Score',
  description: 'Individual 4:13 Baseball game batting and pitching statistics.',
};

export default function BaseballGameBoxScorePage() {
  return <GameBoxScore />;
}
