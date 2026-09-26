'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiGame, BoxscoreResponse, ParsedBattingLine, ParsedPitchingLine } from './types';

type Phase = 'setup' | 'analyzing' | 'review' | 'done';

const BATTING_FIELDS = ['ab', 'r', 'h', '2b', '3b', 'hr', 'rbi', 'bb', 'k', 'sb'] as const;
const BATTING_EXTRA = ['cs', 'hbp', 'sf', 'sac'] as const;
const PITCHING_FIELDS = ['ip', 'h', 'r', 'er', 'bb', 'k', 'hr', 'hbp', 'wp', 'bf', 'w', 'l', 'sv'] as const;

const numOr = (v: string, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function BoxscoreSubmit() {
  const [password, setPassword] = useState('');
  const [games, setGames] = useState<ApiGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [selection, setSelection] = useState<string>('__new');
  const [newGame, setNewGame] = useState({ date: '', opponent: '', tournament: '', venue: '', result: '' });
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BoxscoreResponse | null>(null);
  const [batting, setBatting] = useState<ParsedBattingLine[]>([]);
  const [pitching, setPitching] = useState<ParsedPitchingLine[]>([]);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/baseball/stats', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ games?: ApiGame[] }>;
      })
      .then((d) => {
        if (!alive) return;
        setGames(Array.isArray(d.games) ? d.games : []);
      })
      .catch(() => {
        if (alive) setGames([]);
      })
      .finally(() => {
        if (alive) setGamesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const chosenGame = selection !== '__new' ? games.find((g) => g.id === selection) ?? null : null;

  async function handleAnalyze() {
    setError(null);
    if (!password.trim()) {
      setError('Enter the one-word password first.');
      return;
    }
    if (!file) {
      setError('Choose a box score photo to analyze.');
      return;
    }
    if (selection === '__new' && (!newGame.date.trim() || !newGame.opponent.trim())) {
      setError('For a new game, add at least the date and opponent.');
      return;
    }

    const form = new FormData();
    form.append('password', password);
    form.append('image', file);
    if (selection === '__new') {
      form.append('game_date', newGame.date);
      form.append('opponent', newGame.opponent);
      if (newGame.tournament.trim()) form.append('tournament', newGame.tournament);
      if (newGame.venue.trim()) form.append('venue', newGame.venue);
      if (newGame.result.trim()) form.append('result', newGame.result);
    } else {
      form.append('game_id', selection);
    }

    setPhase('analyzing');
    try {
      const res = await fetch('/api/baseball/boxscore', { method: 'POST', body: form });
      if (res.status === 401) {
        setError('Incorrect password. Try again.');
        setPhase('setup');
        return;
      }
      if (!res.ok) {
        let detail = '';
        try {
          const body = (await res.json()) as { error?: unknown };
          if (body && typeof body.error === 'string') detail = `: ${body.error}`;
        } catch {
          /* ignore */
        }
        setError(`Could not analyze that photo${detail}. Try a clearer shot of the box score.`);
        setPhase('setup');
        return;
      }
      const data = (await res.json()) as BoxscoreResponse;
      if (!data || !Array.isArray(data.batting) || !Array.isArray(data.pitching)) {
        setError('The analysis came back incomplete. Try the photo again.');
        setPhase('setup');
        return;
      }
      setParsed(data);
      setBatting(data.batting);
      setPitching(data.pitching);
      setReplaceConfirmed(false);
      setPhase('review');
    } catch {
      setError('Network error while analyzing. Check your connection and try again.');
      setPhase('setup');
    }
  }

  function updateBatting(i: number, key: keyof ParsedBattingLine, raw: string) {
    setBatting((rows) =>
      rows.map((row, j) => (j === i ? { ...row, [key]: key === 'player' ? raw : numOr(raw, 0) } : row)),
    );
  }

  function updatePitching(i: number, key: keyof ParsedPitchingLine, raw: string) {
    setPitching((rows) =>
      rows.map((row, j) => (j === i ? { ...row, [key]: key === 'player' || key === 'ip' ? raw : numOr(raw, 0) } : row)),
    );
  }

  async function handleConfirm() {
    if (!parsed) return;
    setError(null);
    if (parsed.already_exists && !replaceConfirmed) {
      setError('This game already has stats. Check the box to replace them.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/baseball/boxscore/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          game: parsed.game,
          batting,
          pitching,
        }),
      });
      if (res.status === 401) {
        setError('Incorrect password. Try again.');
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setError('Save failed. Try again.');
        setSaving(false);
        return;
      }
      const body = (await res.json()) as { game_id?: unknown; replaced?: unknown };
      setReplaced(body.replaced === true);
      setSaving(false);
      setPhase('done');
    } catch {
      setError('Network error while saving. Try again.');
      setSaving(false);
    }
  }

  function handleReset() {
    setParsed(null);
    setBatting([]);
    setPitching([]);
    setFile(null);
    setError(null);
    setPhase('setup');
    setReplaceConfirmed(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (phase === 'done') {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-6 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Box Score</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[#12324e]">
          {replaced ? 'Stats replaced' : 'Stats saved'}
        </h2>
        <p className="mt-2 text-sm text-[#6e6e73]">
          {replaced
            ? 'The existing lines for this game were replaced with your upload.'
            : 'The box score was added to the season totals.'}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-4 rounded-full bg-[#12324e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1c3a58]"
        >
          Upload another
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Step 1: auth + game + photo */}
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
          Step 1 &middot; Game &amp; photo
        </p>

        <label htmlFor="bb-password" className="mt-4 block text-[13px] font-bold text-[#12324e]">
          Password
        </label>
        <input
          id="bb-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="One-word password"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        />

        <label htmlFor="bb-game" className="mt-4 block text-[13px] font-bold text-[#12324e]">
          Game
        </label>
        <select
          id="bb-game"
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          disabled={gamesLoading}
          className="mt-1 w-full rounded-xl border border-[#c9dcec] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        >
          <option value="__new">New game&hellip;</option>
          {!gamesLoading &&
            games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.date} vs {g.opponent}
                {g.result ? ` (${g.result})` : ''}
              </option>
            ))}
        </select>

        {selection === '__new' ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bb-date" className="block text-[12px] font-bold text-[#6e6e73]">Date</label>
              <input
                id="bb-date"
                type="date"
                value={newGame.date}
                onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]"
              />
            </div>
            <div>
              <label htmlFor="bb-opponent" className="block text-[12px] font-bold text-[#6e6e73]">Opponent</label>
              <input
                id="bb-opponent"
                type="text"
                value={newGame.opponent}
                onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })}
                placeholder="Team name"
                className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]"
              />
            </div>
            <div>
              <label htmlFor="bb-tournament" className="block text-[12px] font-bold text-[#6e6e73]">Tournament</label>
              <input
                id="bb-tournament"
                type="text"
                value={newGame.tournament}
                onChange={(e) => setNewGame({ ...newGame, tournament: e.target.value })}
                placeholder="Optional"
                className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]"
              />
            </div>
            <div>
              <label htmlFor="bb-venue" className="block text-[12px] font-bold text-[#6e6e73]">Venue</label>
              <input
                id="bb-venue"
                type="text"
                value={newGame.venue}
                onChange={(e) => setNewGame({ ...newGame, venue: e.target.value })}
                placeholder="Optional"
                className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="bb-result" className="block text-[12px] font-bold text-[#6e6e73]">Result</label>
              <input
                id="bb-result"
                type="text"
                value={newGame.result}
                onChange={(e) => setNewGame({ ...newGame, result: e.target.value })}
                placeholder='Optional, e.g. "W 8-5"'
                className="mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]"
              />
            </div>
          </div>
        ) : (
          chosenGame && (
            <p className="mt-2 text-[12px] text-[#6e6e73]">
              {chosenGame.date} &middot; vs {chosenGame.opponent}
              {chosenGame.tournament ? ` \u00B7 ${chosenGame.tournament}` : ''}
              {chosenGame.result ? ` \u00B7 ${chosenGame.result}` : ''}
            </p>
          )
        )}

        <label htmlFor="bb-photo" className="mt-4 block text-[13px] font-bold text-[#12324e]">
          Box score photo
        </label>
        <input
          id="bb-photo"
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-[#3a3a3f] file:mr-3 file:rounded-full file:border-0 file:bg-[#7BAFD4]/20 file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-[#12324e]"
        />
        {file && <p className="mt-1 text-[12px] text-[#6e6e73]">Selected: {file.name}</p>}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-[#fdf0f0] px-3 py-2.5 text-sm font-bold text-[#a82730]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={phase === 'analyzing'}
          className="mt-4 w-full rounded-full bg-[#7BAFD4] px-5 py-3 text-sm font-extrabold text-[#12324e] transition-colors hover:bg-[#6aa2cc] disabled:opacity-60"
        >
          {phase === 'analyzing' ? 'Analyzing photo&hellip;' : 'Analyze'}
        </button>
      </section>

      {/* Step 2: review parsed lines */}
      {phase === 'review' && parsed && (
        <section className="grid gap-5">
          <div className="rounded-2xl border border-[#dde7f0] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
                Step 2 &middot; Review &amp; edit
              </p>
              {parsed.already_exists && (
                <span className="rounded-md bg-[#fdf0f0] px-2 py-1 text-[11px] font-extrabold text-[#a82730]">
                  Already has stats
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-extrabold tracking-tight text-[#12324e]">
              {parsed.game.opponent} &middot; {parsed.game.date}
              {parsed.game.result ? ` \u00B7 ${parsed.game.result}` : ''}
            </h2>
            <p className="mt-1 text-[12px] text-[#6e6e73]">
              Check each line against the photo. Tap a number to fix it.
            </p>
          </div>

          {batting.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
              <h3 className="border-b border-[#eef1f5] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
                Batting
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] tabular-nums">
                  <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
                    <tr>
                      <th className="px-2.5 py-2 text-left">Player</th>
                      {[...BATTING_FIELDS, ...BATTING_EXTRA].map((f) => (
                        <th key={f} className="px-2.5 py-2 text-left">{f.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f4f8]">
                    {batting.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2.5 py-1.5">
                          <input
                            type="text"
                            value={row.player}
                            onChange={(e) => updateBatting(i, 'player', e.target.value)}
                            className="w-28 rounded-md border border-[#dde7f0] px-1.5 py-1 font-bold text-[#12324e]"
                          />
                        </td>
                        {[...BATTING_FIELDS, ...BATTING_EXTRA].map((f) => (
                          <td key={f} className="px-2.5 py-1.5">
                            <input
                              type="number"
                              inputMode="numeric"
                              value={row[f] ?? 0}
                              onChange={(e) => updateBatting(i, f, e.target.value)}
                              className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pitching.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
              <h3 className="border-b border-[#eef1f5] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">
                Pitching
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] tabular-nums">
                  <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
                    <tr>
                      <th className="px-2.5 py-2 text-left">Player</th>
                      {PITCHING_FIELDS.map((f) => (
                        <th key={f} className="px-2.5 py-2 text-left">{f.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f4f8]">
                    {pitching.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2.5 py-1.5">
                          <input
                            type="text"
                            value={row.player}
                            onChange={(e) => updatePitching(i, 'player', e.target.value)}
                            className="w-28 rounded-md border border-[#dde7f0] px-1.5 py-1 font-bold text-[#12324e]"
                          />
                        </td>
                        {PITCHING_FIELDS.map((f) => (
                          <td key={f} className="px-2.5 py-1.5">
                            <input
                              type={f === 'ip' ? 'text' : 'number'}
                              inputMode={f === 'ip' ? 'decimal' : 'numeric'}
                              value={row[f] ?? (f === 'ip' ? '' : 0)}
                              onChange={(e) => updatePitching(i, f, e.target.value)}
                              className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#dde7f0] bg-white p-5">
            {parsed.already_exists && (
              <label className="mb-3 flex items-start gap-2 text-sm text-[#3a3a3f]">
                <input
                  type="checkbox"
                  checked={replaceConfirmed}
                  onChange={(e) => setReplaceConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-bold text-[#12324e]">Replace existing stats for this game.</span>{' '}
                  The current lines will be overwritten with these.
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-[#fdf0f0] px-3 py-2.5 text-sm font-bold text-[#a82730]">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-[#c9dcec] px-5 py-3 text-sm font-bold text-[#12324e]"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 rounded-full bg-[#12324e] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1c3a58] disabled:opacity-60"
              >
                {saving
                  ? 'Saving&hellip;'
                  : parsed.already_exists
                    ? 'Replace existing stats for this game'
                    : 'Confirm & save'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
