import type { Metadata } from 'next';
import { BASEBALL_ROSTER } from '../../../components/baseball/data';
import { RosterList } from '../../../components/baseball/roster-list';

export const metadata: Metadata = {
  title: 'Roster',
  description: '4:13 Baseball 15U roster for the 2026-2027 season: players, positions, and grad years.',
};

export default function BaseballRosterPage() {
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-[#12324e]">Roster</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">
          {BASEBALL_ROSTER.length} players &middot; 2026&ndash;2027 season
        </p>
      </header>

      <RosterList players={BASEBALL_ROSTER} />
    </div>
  );
}
