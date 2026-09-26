import type { Metadata } from 'next';
import { loadPoolStandingsFallback } from '../../../components/baseball/data';
import { StandingsLive } from '../../../components/baseball/standings-live';

export const metadata: Metadata = {
  title: 'Standings',
  description: '4:13 Baseball live Perfect Game tournament pool standings for the 2026-2027 season.',
};

export default async function BaseballStandingsPage() {
  const fallback = loadPoolStandingsFallback();

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-[#12324e]">Standings</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">
          Live pool standings from Perfect Game for this weekend&rsquo;s tournament.
        </p>
      </header>

      <StandingsLive fallback={fallback} />
    </div>
  );
}
