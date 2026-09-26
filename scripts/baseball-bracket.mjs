#!/usr/bin/env node
/**
 * Perfect Game bracket fetcher for the 4:13 Baseball subsite.
 *
 * Used by a GitHub Action on tournament weekends. Reads
 * content/baseball/schedule.json, picks the tournament whose date range
 * contains the current (or coming) weekend, and fetches its bracket page
 * using the URL patterns documented in docs/baseball-brackets.md.
 *
 * Behavior contract:
 *   bracket found     -> content/baseball/bracket.json, prints BRACKET_FOUND=true
 *   bracket not found -> content/baseball/bracket-missing.json, prints BRACKET_FOUND=false
 *   exit 0 in both cases; non-zero only on unexpected errors (e.g. the
 *   schedule file is missing or unreadable).
 *
 * On a found bracket the script also merges the bracket games into the
 * latest dated snapshot under content/baseball/pg-snapshots/ (best-effort;
 * never throws and never changes the contract above).
 *
 * Never invents games: every bracket game is read from the rendered
 * Brackets.aspx table, and rounds are derived from the page's own
 * "Winner of Game #N" links.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRACKET_URL_FOR,
  BROWSER_UA,
  assignRounds,
  parseBracketsPage,
  sideLabel,
} from '../cloudflare/baseball-bracket.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'content', 'baseball');
const SCHEDULE_PATH = join(OUT_DIR, 'schedule.json');
const BRACKET_PATH = join(OUT_DIR, 'bracket.json');
const MISSING_PATH = join(OUT_DIR, 'bracket-missing.json');
const SNAPSHOT_DIR = join(OUT_DIR, 'pg-snapshots');

const TIMEOUT = 45000;
const ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': BROWSER_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await wait(attempt * 2000);
    }
  }
  throw lastError;
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&rsquo;': '’' };
const decodeEntities = (value) => String(value ?? '').replace(/&(?:nbsp|amp|quot|#39|apos|rsquo);/g, (e) => ENTITIES[e] ?? e);
const stripTags = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Today's date in America/Chicago as {year, month, day}. */
function chicagoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [year, month, day] = parts.split('-').map(Number);
  return { year, month, day };
}

const toEpochDay = ({ year, month, day }) => Date.UTC(year, month - 1, day) / 86400000;
const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

/** Saturday/Sunday pair for this weekend if run Sat/Sun, else the coming weekend. */
function targetWeekend() {
  const today = chicagoToday();
  const dow = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay(); // 0=Sun..6=Sat
  const satOffset = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
  const sat = toEpochDay(today) + satOffset;
  return { saturday: sat, sunday: sat + 1 };
}

function weekendTournament(tournaments) {
  const { saturday, sunday } = targetWeekend();
  return tournaments.find((t) => {
    if (!t.start_date || !t.end_date) return false;
    const start = toEpochDay(parseIso(t.start_date));
    const end = toEpochDay(parseIso(t.end_date));
    return start <= sunday && end >= saturday;
  }) ?? null;
}

function writeMissing(tournament, reason) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MISSING_PATH, `${JSON.stringify({
    tournament: tournament ? { name: tournament.name, dates: tournament.dates, event_id: tournament.event_id } : null,
    checked_at: new Date().toISOString(),
    reason,
  }, null, 2)}\n`);
  console.log('BRACKET_FOUND=false');
}

/* Bracket parsing lives in cloudflare/baseball-bracket.mjs, shared with the
 * Worker poller so both read the Brackets.aspx page the same way. */

/**
 * Best-effort merge of the found bracket into the latest dated snapshot
 * (content/baseball/pg-snapshots/). Never throws: the bracket.json output
 * and BRACKET_FOUND contract above are the source of truth; the snapshot
 * merge is enrichment only.
 */
function mergeBracketIntoSnapshot(tournament, bracketUrl, games) {
  try {
    if (!existsSync(SNAPSHOT_DIR)) return;
    const snapshots = readdirSync(SNAPSHOT_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    if (snapshots.length === 0) return;
    const file = snapshots[snapshots.length - 1];
    const path = join(SNAPSHOT_DIR, file);
    const snapshot = JSON.parse(readFileSync(path, 'utf8'));
    const entry = (snapshot.tournaments ?? []).find(
      (t) => String(t.event_id) === String(tournament.event_id));
    if (!entry) {
      console.warn(`baseball-bracket: latest snapshot has no tournament with event_id ${tournament.event_id}; skipping merge`);
      return;
    }
    entry.bracket = {
      bracket_url: bracketUrl,
      scraped_at: new Date().toISOString(),
      games,
    };
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`baseball-bracket: merged bracket into snapshot ${file}`);
  } catch (error) {
    console.warn(`baseball-bracket: snapshot merge skipped: ${error.message}`);
  }
}

async function main() {
  if (!existsSync(SCHEDULE_PATH)) {
    throw new Error(`Schedule file not found at ${SCHEDULE_PATH}; run baseball:schedule first.`);
  }
  const schedule = JSON.parse(readFileSync(SCHEDULE_PATH, 'utf8'));
  const tournaments = Array.isArray(schedule?.tournaments) ? schedule.tournaments : [];
  const tournament = weekendTournament(tournaments);

  if (!tournament) {
    const { saturday } = targetWeekend();
    const satIso = new Date(saturday * 86400000).toISOString().slice(0, 10);
    writeMissing(null, `No tournament in the schedule covers the weekend of ${satIso}.`);
    return;
  }

  const bracketUrl = tournament.bracket_url
    ?? (tournament.event_id ? BRACKET_URL_FOR(tournament.event_id) : null);
  if (!bracketUrl) {
    writeMissing(tournament, 'The schedule has no bracket URL or event id for this tournament.');
    return;
  }

  let html;
  try {
    html = await (await get(bracketUrl)).text();
  } catch (error) {
    writeMissing(tournament, `Bracket page fetch failed: ${error.message}`);
    return;
  }

  const tiers = parseBracketsPage(html, tournament);
  const games = tiers.flatMap(({ tier, games: tierGames }) =>
    assignRounds(tierGames).map((game) => ({
      game_number: game.game_number,
      ...(tier ? { tier } : {}),
      round: game.round,
      matchup: `${sideLabel(game.home)} vs ${sideLabel(game.away)}`,
      date: game.date,
      time: game.time,
      field: game.field,
      venue: game.venue,
    })));
  const ordered = games.sort((a, b) => a.game_number - b.game_number);

  if (ordered.length === 0) {
    writeMissing(tournament, `Bracket page at ${bracketUrl} published no bracket games yet.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(BRACKET_PATH, `${JSON.stringify({
    tournament: tournament.name,
    event_id: tournament.event_id,
    bracket_url: bracketUrl,
    games: ordered.map(({ game_number, ...rest }) => rest),
    scraped_at: new Date().toISOString(),
  }, null, 2)}\n`);
  console.log(`baseball-bracket: wrote ${BRACKET_PATH} (${ordered.length} game(s))`);
  mergeBracketIntoSnapshot(tournament, bracketUrl, ordered);
  console.log('BRACKET_FOUND=true');
}

main().catch((error) => {
  console.error(`baseball-bracket: unexpected error: ${error?.message ?? error}`);
  process.exit(1);
});
