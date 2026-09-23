import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rosterPath = path.join(root, 'content', 'roster-2026.json');
const USER_AGENT = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';

/**
 * Manual corrections for fields MaxPreps leaves blank. Keyed by jersey number.
 * Applied after the MaxPreps parse so a re-sync never wipes them.
 * Every entry needs a verified source noted in the comment.
 */
const OVERRIDES = {
  // #8: MaxPreps has no position or class. WR per game stats and photo
  // captions; Jr. confirmed by Steven Miori 2026-09-23.
  8: { position: 'WR', class: 'Jr.' },
  // #13: MaxPreps has no position or class. Class of 2029 (freshman)
  // confirmed by Steven Miori 2026-09-23. Position still unknown.
  13: { class: 'Fr.' },
};

const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

function nameKeys(name) {
  const normalized = normalize(name);
  const sorted = String(name)
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\.?/g, '')
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .sort()
    .join('');
  return [...new Set([normalized, sorted].filter(Boolean))];
}

function rememberPortrait(map, name, image) {
  for (const key of nameKeys(name)) {
    if (!map.has(key)) map.set(key, image);
  }
}

function portraitFor(map, name) {
  for (const key of nameKeys(name)) {
    const image = map.get(key);
    if (image) return image;
  }
  return undefined;
}

function formatPosition(raw) {
  const parts = String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
}

function formatUpdated(html) {
  const match = html.match(/Roster last updated on <time dateTime="([^"]+)">([^<]+)<\/time>/i)
    ?? html.match(/Roster last updated on ([^<]+)/i);
  if (!match) return null;
  const parsed = new Date(match[1] ?? match[0]);
  if (Number.isFinite(parsed.valueOf())) {
    return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return match[2]?.trim() ?? match[1]?.trim() ?? null;
}

/** MaxPreps exposes every athlete on the team page, but only varsity rows have index 17 false. */
export function parseMaxPrepsRoster(html) {
  const blob = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!blob) throw new Error('MaxPreps roster page did not include __NEXT_DATA__.');
  const data = JSON.parse(blob);
  const athleteData = data.props?.pageProps?.athleteData;
  const expected = data.props?.pageProps?.countData?.athleteCount;
  if (!athleteData) throw new Error('MaxPreps roster page did not include athleteData.');

  const players = Object.values(athleteData)
    .filter(Array.isArray)
    .filter((row) => row[17] === false)
    .map((row) => ({
      number: Number(row[8]),
      name: String(row[33] ?? `${row[5]} ${row[6]}`.trim()).trim(),
      position: formatPosition([row[12], row[13]].filter(Boolean).join(', ')),
      class: String(row[36] ?? '').trim() || '—',
    }))
    .sort((left, right) => left.number - right.number || left.name.localeCompare(right.name));

  if (!Number.isInteger(expected) || players.length !== expected) {
    throw new Error(`Expected ${expected ?? '?'} varsity roster rows; parsed ${players.length}.`);
  }

  const numbers = new Set(players.map((player) => player.number));
  if (numbers.size !== players.length) throw new Error('Varsity roster still contains duplicate numbers.');

  return { players, updated: formatUpdated(html) ?? 'Unknown' };
}

async function main() {
  const existing = JSON.parse(await readFile(rosterPath, 'utf8'));
  const imagesByName = new Map();
  for (const player of existing.players) {
    if (!player.image) continue;
    rememberPortrait(imagesByName, player.name, player.image);
  }

  const response = await fetch(existing.sourceUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`MaxPreps roster returned HTTP ${response.status}`);
  const html = await response.text();
  const { players, updated } = parseMaxPrepsRoster(html);

  let portraits = 0;
  for (const player of players) {
    const image = portraitFor(imagesByName, player.name);
    if (image) {
      player.image = image;
      portraits += 1;
    }
  }

  const roster = {
    source: existing.source,
    sourceUrl: existing.sourceUrl,
    updated,
    players: players.map((player) => ({ ...player, ...(OVERRIDES[player.number] ?? {}) })),
  };

  await writeFile(rosterPath, `${JSON.stringify(roster, null, 2)}\n`);
  console.log(`Synced ${players.length} varsity players from MaxPreps; kept ${portraits} local portraits.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
