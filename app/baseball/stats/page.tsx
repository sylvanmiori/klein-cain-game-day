import type { Metadata } from 'next';
import { BaseballStatsTables } from '../../../components/baseball/stats-tables';

export const metadata: Metadata = {
  title: 'Stats',
  description: '4:13 Baseball 15U season stats — batting and pitching leaderboards for the 2026-2027 season.',
};

export default function BaseballStatsPage() {
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-[#12324e]">Stats</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">Season batting and pitching leaders.</p>
      </header>
      <BaseballStatsTables />
    </div>
  );
}
