'use client';

import { useEffect, useState } from 'react';
import type { RosterPlayer, StatsResponse } from './types';
import { PlayerNameLink } from './player-name-link';

export function RosterList({ players }: { players: RosterPlayer[] }) {
  const [idByName, setIdByName] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<StatsResponse>) : null))
      .then((data) => {
        if (!alive || !data?.players) return;
        const map = new Map<string, number>();
        for (const p of data.players) {
          if (p.name && typeof p.id === 'number') map.set(p.name, p.id);
        }
        setIdByName(map);
      })
      .catch(() => {
        /* roster still renders plain names */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {players.map((p) => (
        <li key={p.name} className="rounded-2xl border border-[#dde7f0] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-extrabold tracking-tight text-[#12324e]">
              <PlayerNameLink playerId={idByName.get(p.name)} name={p.name} />
            </p>
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
  );
}
