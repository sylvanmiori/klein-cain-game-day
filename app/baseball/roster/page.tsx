import type { Metadata } from 'next';
import { BASEBALL_ROSTER } from '../../../components/baseball/data';

export const metadata: Metadata = {
  title: 'Roster',
  description: '4:13 Baseball 15U roster for the 2026-2027 season — players, positions, and grad years.',
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

      <ul className="grid gap-3 sm:grid-cols-2">
        {BASEBALL_ROSTER.map((p) => (
          <li key={p.name} className="rounded-2xl border border-[#dde7f0] bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-extrabold tracking-tight text-[#12324e]">{p.name}</p>
              <span className="shrink-0 rounded-md bg-[#7BAFD4]/20 px-2 py-0.5 text-[11px] font-extrabold text-[#12324e]">
                {p.pos}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-[#6e6e73]">
              <span className="font-bold text-[#3a3a3f]">Class of {p.gradYear}</span>
              {p.bt ? ` \u00B7 B/T ${p.bt}` : ''}
              {p.ht ? ` \u00B7 ${p.ht}` : ''}
              {p.wt ? `, ${p.wt} lbs` : ''}
            </p>
            {(p.hometown || p.hs) && (
              <p className="mt-0.5 text-[12px] text-[#6e6e73]">
                {[p.hometown, p.hs].filter(Boolean).join(' \u00B7 ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
