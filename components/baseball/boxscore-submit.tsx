'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ApiGame,
  ApiPlayer,
  BoxscoreResponse,
  EditableBattingLine,
  EditablePitchingLine,
  GameDetailResponse,
  ParsedBattingLine,
  ParsedPitchingLine,
  StatsResponse,
  UncertainMatch,
} from './types';

type Mode = 'upload' | 'manual' | 'edit';

const PASSWORD_KEY = 'bb-boxscore-password';

const BATTING_FIELDS = [
  'ab', 'r', 'h', '1b', '2b', '3b', 'hr', 'rbi', 'bb', 'k', 'sb', 'cs', 'hbp', 'sf', 'sac', 'e',
] as const;
const PITCHING_FIELDS = [
  'ip', 'h', 'r', 'er', 'bb', 'k', 'hr', 'hbp', 'wp', 'bf', 'pitches', 'strikes', 'w', 'l', 'sv',
] as const;

const BAT_LABELS: Record<string, string> = {
  ab: 'AB', r: 'R', h: 'H', '1b': '1B', '2b': '2B', '3b': '3B', hr: 'HR', rbi: 'RBI',
  bb: 'BB', k: 'K', sb: 'SB', cs: 'CS', hbp: 'HBP', sf: 'SF', sac: 'SAC', e: 'E',
};
const PITCH_LABELS: Record<string, string> = {
  ip: 'IP', h: 'H', r: 'R', er: 'ER', bb: 'BB', k: 'K', hr: 'HR', hbp: 'HBP',
  wp: 'WP', bf: 'BF', pitches: 'P', strikes: 'S', w: 'W', l: 'L', sv: 'SV',
};

const numOr = (v: string, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const emptyBatting = (player = '', jersey = '', pos = ''): EditableBattingLine => ({
  player, jersey, pos,
  ab: 0, r: 0, h: 0, '1b': 0, '2b': 0, '3b': 0, hr: 0, rbi: 0,
  bb: 0, k: 0, sb: 0, cs: 0, hbp: 0, sf: 0, sac: 0, e: 0,
});

const emptyPitching = (player = '', jersey = ''): EditablePitchingLine => ({
  player, jersey, ip: '',
  h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, hbp: 0, wp: 0, bf: 0,
  pitches: 0, strikes: 0, w: 0, l: 0, sv: 0,
});

function fromParsedBatting(line: ParsedBattingLine): EditableBattingLine {
  const row = emptyBatting(line.player ?? '', line.jersey == null ? '' : String(line.jersey), line.pos ?? '');
  const nums = row as unknown as Record<string, number>;
  for (const f of BATTING_FIELDS) nums[f] = numOr(String(line[f] ?? 0), 0);
  return row;
}

function fromParsedPitching(line: ParsedPitchingLine): EditablePitchingLine {
  const row = emptyPitching(line.player ?? '', line.jersey == null ? '' : String(line.jersey));
  const cells = row as unknown as Record<string, string | number>;
  for (const f of PITCHING_FIELDS) {
    cells[f] = f === 'ip' ? String(line.ip ?? '') : numOr(String(line[f] ?? 0), 0);
  }
  return row;
}

function jerseyPayload(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function battingPayload(rows: EditableBattingLine[]) {
  return rows
    .filter((r) => r.player.trim() !== '')
    .map((r) => ({
      player: r.player.trim(),
      jersey: jerseyPayload(r.jersey),
      pos: r.pos.trim() || null,
      ...Object.fromEntries(BATTING_FIELDS.map((f) => [f, numOr(String(r[f]), 0)])),
    }));
}

function pitchingPayload(rows: EditablePitchingLine[]) {
  return rows
    .filter((r) => r.player.trim() !== '')
    .map((r) => ({
      player: r.player.trim(),
      jersey: jerseyPayload(r.jersey),
      ip: r.ip.trim(),
      ...Object.fromEntries(
        PITCHING_FIELDS.filter((f) => f !== 'ip').map((f) => [f, numOr(String(r[f as keyof EditablePitchingLine]), 0)]),
      ),
    }));
}

/** True when every stat on the row is zero/blank — used to skip untouched roster-prefill rows on manual save. */
function isBlankBatting(r: EditableBattingLine): boolean {
  return BATTING_FIELDS.every((f) => numOr(String(r[f]), 0) === 0);
}
function isBlankPitching(r: EditablePitchingLine): boolean {
  const ipZero = r.ip.trim() === '' || Number(r.ip) === 0;
  return ipZero && PITCHING_FIELDS.filter((f) => f !== 'ip').every((f) => numOr(String(r[f as keyof EditablePitchingLine]), 0) === 0);
}

/** Pull the two scores out of a result string like "W 9-10" (our score first). */
function parseResultScores(text?: string | null): { ours: number; theirs: number } | null {
  const m = /(\d+)\s*[-–—]\s*(\d+)/.exec(text ?? '');
  if (!m) return null;
  return { ours: Number(m[1]), theirs: Number(m[2]) };
}

/**
 * Loose validation: warn when player-line sums disagree with the team totals
 * from the screenshot header. Warnings NEVER block saving — Steven's word is final.
 */
function totalWarnings(
  batting: EditableBattingLine[],
  pitching: EditablePitchingLine[],
  ours: number | null | undefined,
  theirs: number | null | undefined,
): string[] {
  const out: string[] = [];
  const batR = batting.reduce((s, r) => s + numOr(String(r.r), 0), 0);
  const pitR = pitching.reduce((s, r) => s + numOr(String(r.r), 0), 0);
  if (ours != null && batR !== ours) {
    out.push(`Batting runs (${batR}) don't match the team total (${ours}).`);
  }
  if (theirs != null && pitR !== theirs) {
    out.push(`Pitching runs allowed (${pitR}) don't match the team total (${theirs}).`);
  }
  return out;
}

function updateBattingRow(rows: EditableBattingLine[], i: number, key: keyof EditableBattingLine, raw: string) {
  return rows.map((row, j) => {
    if (j !== i) return row;
    const value = key === 'player' || key === 'jersey' || key === 'pos' ? raw : numOr(raw, 0);
    return { ...row, [key]: value } as EditableBattingLine;
  });
}

function updatePitchingRow(rows: EditablePitchingLine[], i: number, key: keyof EditablePitchingLine, raw: string) {
  return rows.map((row, j) => {
    if (j !== i) return row;
    const value = key === 'player' || key === 'jersey' || key === 'ip' ? raw : numOr(raw, 0);
    return { ...row, [key]: value } as EditablePitchingLine;
  });
}

/** Does this grid row match an uncertain player-match flag from the parser? */
function isUncertain(row: { player: string; jersey: string }, uncertain: UncertainMatch[] | undefined): UncertainMatch | null {
  if (!uncertain?.length) return null;
  const name = row.player.trim().toLowerCase();
  const jersey = row.jersey.trim();
  return (
    uncertain.find(
      (u) =>
        (u.player.trim().toLowerCase() !== '' && u.player.trim().toLowerCase() === name) ||
        (u.jersey != null && jersey !== '' && String(u.jersey) === jersey),
    ) ?? null
  );
}

// ---------- small presentational pieces ----------

function PasswordGate({
  password,
  setPassword,
  error,
  onSubmit,
}: {
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-[#dde7f0] bg-white p-6 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">4:13 Baseball</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-[#12324e]">Box score tools</h2>
      <p className="mt-2 text-sm text-[#6e6e73]">
        This whole area is password-protected. Enter the one-word password once and it stays for this visit.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-4"
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="One-word password"
          autoComplete="off"
          className="w-full rounded-xl border border-[#c9dcec] px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#fdf0f0] px-3 py-2.5 text-sm font-bold text-[#a82730]">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-3 w-full rounded-full bg-[#12324e] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1c3a58]"
        >
          Unlock
        </button>
      </form>
    </section>
  );
}

function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; hint: string }[] = [
    { id: 'upload', label: 'Upload', hint: 'Photos → parse → review' },
    { id: 'manual', label: 'Manual entry', hint: 'Type the lines in' },
    { id: 'edit', label: 'Edit', hint: 'Fix or delete a game' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Submit modes">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={mode === t.id}
          onClick={() => setMode(t.id)}
          className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
            mode === t.id
              ? 'border-[#12324e] bg-[#12324e] text-white'
              : 'border-[#dde7f0] bg-white text-[#12324e] hover:border-[#7BAFD4]'
          }`}
        >
          <span className="block text-sm font-extrabold">{t.label}</span>
          <span className={`mt-0.5 block text-[11px] ${mode === t.id ? 'text-white/70' : 'text-[#9a9aa2]'}`}>
            {t.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

function GameMetaFields({
  value,
  onChange,
}: {
  value: { date: string; opponent: string; tournament: string; venue: string; result: string };
  onChange: (v: { date: string; opponent: string; tournament: string; venue: string; result: string }) => void;
}) {
  const set = (k: keyof typeof value) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const cls = 'mt-1 w-full rounded-xl border border-[#c9dcec] px-3 py-2 text-sm outline-none focus:border-[#7BAFD4]';
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[12px] font-bold text-[#6e6e73]">Date</label>
        <input type="date" value={value.date} onChange={set('date')} className={cls} />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[#6e6e73]">Opponent</label>
        <input type="text" value={value.opponent} onChange={set('opponent')} placeholder="Team name" className={cls} />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[#6e6e73]">Tournament</label>
        <input type="text" value={value.tournament} onChange={set('tournament')} placeholder="Optional" className={cls} />
      </div>
      <div>
        <label className="block text-[12px] font-bold text-[#6e6e73]">Venue</label>
        <input type="text" value={value.venue} onChange={set('venue')} placeholder="Optional" className={cls} />
      </div>
      <div className="col-span-2">
        <label className="block text-[12px] font-bold text-[#6e6e73]">Result</label>
        <input
          type="text"
          value={value.result}
          onChange={set('result')}
          placeholder='e.g. "W 8-5"'
          className={cls}
        />
      </div>
    </div>
  );
}

function Warnings({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div role="alert" className="rounded-2xl border border-[#e8c86a] bg-[#fff8e6] p-4">
      <p className="text-[13px] font-extrabold text-[#8a6d1a]">Heads up — totals don't line up</p>
      <ul className="mt-1 list-disc pl-5 text-[13px] text-[#6e5c14]">
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] text-[#8a7a2e]">Saving is never blocked by this — your numbers are final.</p>
    </div>
  );
}

function BattingGrid({
  rows,
  setRows,
  uncertain,
}: {
  rows: EditableBattingLine[];
  setRows: (fn: (rows: EditableBattingLine[]) => EditableBattingLine[]) => void;
  uncertain?: UncertainMatch[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Batting</h3>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyBatting()])}
          className="rounded-full border border-[#c9dcec] px-3 py-1 text-[12px] font-bold text-[#12324e] hover:border-[#7BAFD4]"
        >
          + Add player
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
            <tr>
              <th className="px-2.5 py-2 text-left">Player</th>
              <th className="px-2.5 py-2 text-left" title="Jersey number">#</th>
              <th className="px-2.5 py-2 text-left">Pos</th>
              {BATTING_FIELDS.map((f) => (
                <th key={f} className="px-2.5 py-2 text-left">{BAT_LABELS[f]}</th>
              ))}
              <th className="px-2.5 py-2" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f4f8]">
            {rows.map((row, i) => {
              const flag = isUncertain(row, uncertain);
              return (
                <tr key={i} className={flag ? 'bg-[#fff8e6]' : undefined} title={flag ? `Uncertain match: ${flag.reason}` : undefined}>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {flag && <span aria-hidden="true" title={flag.reason}>⚠️</span>}
                      <input
                        type="text"
                        value={row.player}
                        onChange={(e) => setRows((rs) => updateBattingRow(rs, i, 'player', e.target.value))}
                        className="w-28 rounded-md border border-[#dde7f0] px-1.5 py-1 font-bold text-[#12324e]"
                      />
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.jersey}
                      onChange={(e) => setRows((rs) => updateBattingRow(rs, i, 'jersey', e.target.value))}
                      className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      type="text"
                      value={row.pos}
                      onChange={(e) => setRows((rs) => updateBattingRow(rs, i, 'pos', e.target.value))}
                      className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                    />
                  </td>
                  {BATTING_FIELDS.map((f) => (
                    <td key={f} className="px-2.5 py-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={row[f]}
                        onChange={(e) => setRows((rs) => updateBattingRow(rs, i, f, e.target.value))}
                        className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                      />
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5">
                    <button
                      type="button"
                      aria-label={`Remove ${row.player || 'row'}`}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="rounded-full px-2 py-1 text-[13px] font-bold text-[#a82730] hover:bg-[#fdf0f0]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={BATTING_FIELDS.length + 4} className="px-4 py-6 text-center text-[13px] text-[#9a9aa2]">
                  No batting lines yet. Add a player to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PitchingGrid({
  rows,
  setRows,
  uncertain,
}: {
  rows: EditablePitchingLine[];
  setRows: (fn: (rows: EditablePitchingLine[]) => EditablePitchingLine[]) => void;
  uncertain?: UncertainMatch[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde7f0] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#12324e]">Pitching</h3>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyPitching()])}
          className="rounded-full border border-[#c9dcec] px-3 py-1 text-[12px] font-bold text-[#12324e] hover:border-[#7BAFD4]"
        >
          + Add pitcher
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead className="border-b border-[#eef1f5] text-[11px] uppercase tracking-wide text-[#9a9aa2]">
            <tr>
              <th className="px-2.5 py-2 text-left">Player</th>
              <th className="px-2.5 py-2 text-left" title="Jersey number">#</th>
              {PITCHING_FIELDS.map((f) => (
                <th
                  key={f}
                  className="px-2.5 py-2 text-left"
                  title={f === 'pitches' ? 'Pitches' : f === 'strikes' ? 'Strikes' : undefined}
                >
                  {PITCH_LABELS[f]}
                </th>
              ))}
              <th className="px-2.5 py-2" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f4f8]">
            {rows.map((row, i) => {
              const flag = isUncertain(row, uncertain);
              return (
                <tr key={i} className={flag ? 'bg-[#fff8e6]' : undefined} title={flag ? `Uncertain match: ${flag.reason}` : undefined}>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {flag && <span aria-hidden="true" title={flag.reason}>⚠️</span>}
                      <input
                        type="text"
                        value={row.player}
                        onChange={(e) => setRows((rs) => updatePitchingRow(rs, i, 'player', e.target.value))}
                        className="w-28 rounded-md border border-[#dde7f0] px-1.5 py-1 font-bold text-[#12324e]"
                      />
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.jersey}
                      onChange={(e) => setRows((rs) => updatePitchingRow(rs, i, 'jersey', e.target.value))}
                      className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                    />
                  </td>
                  {PITCHING_FIELDS.map((f) => (
                    <td key={f} className="px-2.5 py-1.5">
                      <input
                        type={f === 'ip' ? 'text' : 'number'}
                        inputMode={f === 'ip' ? 'decimal' : 'numeric'}
                        value={row[f as keyof EditablePitchingLine] as string | number}
                        onChange={(e) => setRows((rs) => updatePitchingRow(rs, i, f as keyof EditablePitchingLine, e.target.value))}
                        className="w-12 rounded-md border border-[#dde7f0] px-1.5 py-1 text-[#3a3a3f]"
                      />
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5">
                    <button
                      type="button"
                      aria-label={`Remove ${row.player || 'row'}`}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="rounded-full px-2 py-1 text-[13px] font-bold text-[#a82730] hover:bg-[#fdf0f0]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={PITCHING_FIELDS.length + 3} className="px-4 py-6 text-center text-[13px] text-[#9a9aa2]">
                  No pitching lines yet. Add a pitcher to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function gameLabel(g: ApiGame): string {
  return `${g.date} vs ${g.opponent}${g.result ? ` (${g.result})` : ''}`;
}

// ---------- mode: upload ----------

type UploadPhase = 'setup' | 'analyzing' | 'review' | 'done';

function UploadMode({
  password,
  games,
  onAuthFail,
  onSaved,
}: {
  password: string;
  games: ApiGame[];
  onAuthFail: (msg: string) => void;
  onSaved: () => void;
}) {
  const [selection, setSelection] = useState('__new');
  const [newGame, setNewGame] = useState({ date: '', opponent: '', tournament: '', venue: '', result: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<UploadPhase>('setup');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<BoxscoreResponse | null>(null);
  const [batting, setBatting] = useState<EditableBattingLine[]>([]);
  const [pitching, setPitching] = useState<EditablePitchingLine[]>([]);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const chosenGame = selection !== '__new' ? games.find((g) => String(g.id) === selection) ?? null : null;

  async function handleAnalyze() {
    setError(null);
    if (!password.trim()) {
      setError('Password missing — lock and unlock again.');
      return;
    }
    if (files.length === 0) {
      setError('Choose at least one box score photo (batting and/or pitching view).');
      return;
    }
    if (selection === '__new' && (!newGame.date.trim() || !newGame.opponent.trim())) {
      setError('For a new game, add at least the date and opponent.');
      return;
    }

    const form = new FormData();
    form.append('password', password);
    for (const f of files) form.append('images[]', f);
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
        onAuthFail('Incorrect password. Enter it again.');
        setPhase('setup');
        return;
      }
      if (res.status === 429) {
        setError('Too many failed password attempts. Wait a few minutes and try again.');
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
        setError(`Could not analyze those photos${detail}. Try clearer shots of the box score.`);
        setPhase('setup');
        return;
      }
      const data = (await res.json()) as BoxscoreResponse;
      if (!data || !Array.isArray(data.batting) || !Array.isArray(data.pitching)) {
        setError('The analysis came back incomplete. Try the photos again.');
        setPhase('setup');
        return;
      }
      setParsed(data);
      setBatting(data.batting.map(fromParsedBatting));
      setPitching(data.pitching.map(fromParsedPitching));
      setReplaceConfirmed(false);
      setPhase('review');
    } catch {
      setError('Network error while analyzing. Check your connection and try again.');
      setPhase('setup');
    }
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
          batting: battingPayload(batting),
          pitching: pitchingPayload(pitching),
        }),
      });
      if (res.status === 401) {
        onAuthFail('Incorrect password. Enter it again.');
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
      onSaved();
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
    setFiles([]);
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

  const warnings =
    phase === 'review' && parsed
      ? totalWarnings(batting, pitching, parsed.game.our_score ?? null, parsed.game.opp_score ?? null)
      : [];

  return (
    <div className="grid gap-5">
      {/* Step 1: game + photos */}
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
          Step 1 &middot; Game &amp; photos
        </p>

        <label htmlFor="bb-game" className="mt-4 block text-[13px] font-bold text-[#12324e]">
          Game
        </label>
        <select
          id="bb-game"
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#c9dcec] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        >
          <option value="__new">New game&hellip;</option>
          {games.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {gameLabel(g)}
            </option>
          ))}
        </select>

        {selection === '__new' ? (
          <div className="mt-3">
            <GameMetaFields value={newGame} onChange={setNewGame} />
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
          Box score photos
        </label>
        <input
          id="bb-photo"
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-1 w-full text-sm text-[#3a3a3f] file:mr-3 file:rounded-full file:border-0 file:bg-[#7BAFD4]/20 file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-[#12324e]"
        />
        {files.length > 0 && (
          <ul className="mt-1 text-[12px] text-[#6e6e73]">
            {files.map((f, i) => (
              <li key={i}>Selected: {f.name}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[12px] text-[#9a9aa2]">
          One game is up to two screenshots: the batting view and the pitching view. They are read as one game.
        </p>

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
          {phase === 'analyzing' ? 'Analyzing photos…' : 'Analyze'}
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
              Check each line against the photos. Tap a number to fix it. Rows flagged ⚠️ are uncertain
              player matches — fix the name or jersey before saving.
            </p>
          </div>

          {parsed.uncertain && parsed.uncertain.length > 0 && (
            <div role="alert" className="rounded-2xl border border-[#e8c86a] bg-[#fff8e6] p-4">
              <p className="text-[13px] font-extrabold text-[#8a6d1a]">Uncertain player matches</p>
              <ul className="mt-1 list-disc pl-5 text-[13px] text-[#6e5c14]">
                {parsed.uncertain.map((u, i) => (
                  <li key={i}>
                    {u.player}
                    {u.jersey != null ? ` (#${u.jersey})` : ''} — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Warnings messages={warnings} />

          <BattingGrid rows={batting} setRows={setBatting} uncertain={parsed.uncertain} />
          <PitchingGrid rows={pitching} setRows={setPitching} uncertain={parsed.uncertain} />

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
                  ? 'Saving…'
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

// ---------- mode: manual entry ----------

function ManualMode({
  password,
  games,
  roster,
  onAuthFail,
  onSaved,
}: {
  password: string;
  games: ApiGame[];
  roster: ApiPlayer[];
  onAuthFail: (msg: string) => void;
  onSaved: () => void;
}) {
  const [selection, setSelection] = useState('__new');
  const [meta, setMeta] = useState({ date: '', opponent: '', tournament: '', venue: '', result: '' });
  const [batting, setBatting] = useState<EditableBattingLine[]>([]);
  const [pitching, setPitching] = useState<EditablePitchingLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const prefilled = useRef(false);

  // Pre-fill one zeroed row per roster player so names/jerseys don't need typing.
  useEffect(() => {
    if (!prefilled.current && roster.length > 0 && batting.length === 0) {
      prefilled.current = true;
      setBatting(
        roster.map((p) => emptyBatting(p.name, p.jersey_number != null ? String(p.jersey_number) : '', p.pos ?? '')),
      );
    }
  }, [roster, batting.length]);

  const existingGame = selection !== '__new';
  const scores = parseResultScores(meta.result);
  const warnings = totalWarnings(
    batting.filter((r) => !isBlankBatting(r)),
    pitching.filter((r) => !isBlankPitching(r)),
    scores?.ours ?? null,
    scores?.theirs ?? null,
  );

  async function handleSave() {
    setError(null);
    if (selection === '__new' && (!meta.date.trim() || !meta.opponent.trim())) {
      setError('For a new game, add at least the date and opponent.');
      return;
    }
    const battingRows = battingPayload(batting.filter((r) => !isBlankBatting(r)));
    const pitchingRows = pitchingPayload(pitching.filter((r) => !isBlankPitching(r)));
    if (battingRows.length === 0 && pitchingRows.length === 0) {
      setError('Fill in at least one line before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/baseball/boxscore/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          game: selection === '__new' ? { id: null, ...meta } : { id: Number(selection) },
          batting: battingRows,
          pitching: pitchingRows,
        }),
      });
      if (res.status === 401) {
        onAuthFail('Incorrect password. Enter it again.');
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setError('Save failed. Try again.');
        setSaving(false);
        return;
      }
      onSaved();
      setSaving(false);
      setDone(true);
    } catch {
      setError('Network error while saving. Try again.');
      setSaving(false);
    }
  }

  function handleReset() {
    setDone(false);
    setMeta({ date: '', opponent: '', tournament: '', venue: '', result: '' });
    setSelection('__new');
    setBatting(roster.map((p) => emptyBatting(p.name, p.jersey_number != null ? String(p.jersey_number) : '', p.pos ?? '')));
    setPitching([]);
    setError(null);
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-6 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Box Score</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[#12324e]">Lines saved</h2>
        <p className="mt-2 text-sm text-[#6e6e73]">The typed lines were added to the season totals.</p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-4 rounded-full bg-[#12324e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1c3a58]"
        >
          Enter another game
        </button>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Game</p>
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[#c9dcec] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        >
          <option value="__new">New game…</option>
          {games.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {gameLabel(g)}
            </option>
          ))}
        </select>
        {existingGame ? (
          <p className="mt-2 text-[12px] font-bold text-[#a82730]">
            Saving will replace the existing lines for this game.
          </p>
        ) : (
          <div className="mt-3">
            <GameMetaFields value={meta} onChange={setMeta} />
          </div>
        )}
      </section>

      <Warnings messages={warnings} />

      <BattingGrid rows={batting} setRows={setBatting} />
      <PitchingGrid rows={pitching} setRows={setPitching} />

      <div className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[12px] text-[#9a9aa2]">
          Rows left all-zero are skipped on save. Players not on the roster yet can be added with the + buttons —
          they join the roster automatically.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#fdf0f0] px-3 py-2.5 text-sm font-bold text-[#a82730]">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-full bg-[#12324e] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1c3a58] disabled:opacity-60"
        >
          {saving ? 'Saving…' : existingGame ? 'Replace lines for this game' : 'Save lines'}
        </button>
      </div>
    </div>
  );
}

// ---------- mode: edit ----------

function EditMode({
  password,
  games,
  onAuthFail,
  onSaved,
}: {
  password: string;
  games: ApiGame[];
  onAuthFail: (msg: string) => void;
  onSaved: () => void;
}) {
  const [selection, setSelection] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ date: '', opponent: '', tournament: '', venue: '', result: '' });
  const [batting, setBatting] = useState<EditableBattingLine[]>([]);
  const [pitching, setPitching] = useState<EditablePitchingLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadGame(id: string) {
    setSelection(id);
    setError(null);
    setNotice(null);
    setConfirmDelete(false);
    if (!id) {
      setBatting([]);
      setPitching([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/baseball/games/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail = (await res.json()) as GameDetailResponse;
      setMeta({
        date: detail.game.date ?? '',
        opponent: detail.game.opponent ?? '',
        tournament: detail.game.tournament ?? '',
        venue: detail.game.venue ?? '',
        result: detail.game.result ?? '',
      });
      setBatting(detail.batting.map(fromParsedBatting));
      setPitching(detail.pitching.map(fromParsedPitching));
    } catch {
      setError('Could not load that game. Try again.');
      setBatting([]);
      setPitching([]);
    } finally {
      setLoading(false);
    }
  }

  const scores = parseResultScores(meta.result);
  const warnings = totalWarnings(batting, pitching, scores?.ours ?? null, scores?.theirs ?? null);

  async function handleSave() {
    if (!selection) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/baseball/games/${selection}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          game: meta,
          batting: battingPayload(batting),
          pitching: pitchingPayload(pitching),
        }),
      });
      if (res.status === 401) {
        onAuthFail('Incorrect password. Enter it again.');
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setError('Save failed. Try again.');
        setSaving(false);
        return;
      }
      onSaved();
      setNotice('Lines saved — the season totals are updated.');
      setSaving(false);
    } catch {
      setError('Network error while saving. Try again.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selection) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/baseball/games/${selection}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        onAuthFail('Incorrect password. Enter it again.');
        setDeleting(false);
        return;
      }
      if (!res.ok) {
        setError('Delete failed. Try again.');
        setDeleting(false);
        return;
      }
      onSaved();
      setDeleting(false);
      setConfirmDelete(false);
      loadGame('');
    } catch {
      setError('Network error while deleting. Try again.');
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">Pick a game to edit</p>
        <select
          value={selection}
          onChange={(e) => loadGame(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[#c9dcec] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7BAFD4]"
        >
          <option value="">Choose a game…</option>
          {games.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {gameLabel(g)}
            </option>
          ))}
        </select>
        {loading && <p className="mt-2 text-[12px] text-[#6e6e73]">Loading lines…</p>}
      </section>

      {selection !== '' && !loading && (
        <>
          <section className="rounded-2xl border border-[#dde7f0] bg-white p-5">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9a9aa2]">
              Game details
            </p>
            <GameMetaFields value={meta} onChange={setMeta} />
          </section>

          <Warnings messages={warnings} />

          <BattingGrid rows={batting} setRows={setBatting} />
          <PitchingGrid rows={pitching} setRows={setPitching} />

          <div className="rounded-2xl border border-[#dde7f0] bg-white p-5">
            {notice && (
              <p role="status" className="mb-3 rounded-xl bg-[#eef7ee] px-3 py-2.5 text-sm font-bold text-[#1e6b2e]">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-[#fdf0f0] px-3 py-2.5 text-sm font-bold text-[#a82730]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-full bg-[#12324e] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1c3a58] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes (replaces all lines)'}
            </button>

            <div className="mt-4 border-t border-[#eef1f5] pt-4">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-full border border-[#e5b4b8] px-5 py-2.5 text-sm font-bold text-[#a82730] hover:bg-[#fdf0f0]"
                >
                  Delete this game
                </button>
              ) : (
                <div className="rounded-xl bg-[#fdf0f0] p-4">
                  <p className="text-sm font-extrabold text-[#a82730]">
                    Delete this game and all of its lines? This can't be undone.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-full border border-[#c9dcec] px-5 py-2.5 text-sm font-bold text-[#12324e]"
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 rounded-full bg-[#a82730] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#8f2229] disabled:opacity-60"
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- top-level: password-gated area ----------

export function BoxscoreSubmit() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('upload');
  const [stats, setStats] = useState<StatsResponse | null>(null);

  // Enter the word once per visit; every write request re-sends it and the
  // server re-checks it.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PASSWORD_KEY);
      if (saved) {
        setPassword(saved);
        setAuthed(true);
      }
    } catch {
      /* sessionStorage unavailable — fall back to per-visit entry */
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/baseball/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats((await res.json()) as StatsResponse);
    } catch {
      /* keep whatever we had; selects just come up empty */
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAuthFail = useCallback((msg: string) => {
    try {
      sessionStorage.removeItem(PASSWORD_KEY);
    } catch {
      /* ignore */
    }
    setPassword('');
    setAuthed(false);
    setGateError(msg);
  }, []);

  function handleGateSubmit() {
    if (!password.trim()) {
      setGateError('Enter the one-word password.');
      return;
    }
    try {
      sessionStorage.setItem(PASSWORD_KEY, password.trim());
    } catch {
      /* sessionStorage unavailable — the word still works for this render */
    }
    setPassword(password.trim());
    setAuthed(true);
    setGateError(null);
  }

  function handleLock() {
    handleAuthFail('Locked. Enter the password to continue.');
  }

  if (!authed) {
    return <PasswordGate password={password} setPassword={setPassword} error={gateError} onSubmit={handleGateSubmit} />;
  }

  const games: ApiGame[] = stats?.games ?? [];
  const roster: ApiPlayer[] = stats?.players ?? [];

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-[#1e6b2e]">Unlocked for this visit</p>
        <button
          type="button"
          onClick={handleLock}
          className="rounded-full border border-[#c9dcec] px-3 py-1 text-[12px] font-bold text-[#12324e] hover:border-[#7BAFD4]"
        >
          Lock
        </button>
      </div>

      <ModeTabs mode={mode} setMode={setMode} />

      {mode === 'upload' && (
        <UploadMode password={password} games={games} onAuthFail={handleAuthFail} onSaved={loadStats} />
      )}
      {mode === 'manual' && (
        <ManualMode
          password={password}
          games={games}
          roster={roster}
          onAuthFail={handleAuthFail}
          onSaved={loadStats}
        />
      )}
      {mode === 'edit' && (
        <EditMode password={password} games={games} onAuthFail={handleAuthFail} onSaved={loadStats} />
      )}
    </div>
  );
}
