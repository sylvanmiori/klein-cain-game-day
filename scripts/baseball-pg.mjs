#!/usr/bin/env node
/**
 * Perfect Game capture for the 4:13 Baseball subsite.
 *
 * Captures EVERYTHING public from the team's Perfect Game pages:
 *   - team page: team metadata, the FULL ROSTER table, and the full TEAM
 *     SCHEDULE (every tournament with dates, cities, venues, and every game).
 *   - each tournament's event page: event metadata, age divisions, and the
 *     public scoreboard (visitor/home, runs, game status, DiamondKast game
 *     id). Scoreboard rows are joined back to schedule games by game id, so
 *     `result` / `runs_for` / `runs_against` appear on games once final.
 *   - each tournament's pool-standings page: every pool with every team's
 *     seed, W/L/T, runs against/for, and 4:13's own record in the event.
 *
 * PAYWALL BOUNDARY (Steven's directive): Perfect Game player stats are
 * DiamondKast-paywalled. This script never touches paywalled content and
 * never attempts to bypass a login or paywall. DiamondKast game pages are
 * linked, never fetched. Anything that turns out to be postback-only or
 * unscrapable is recorded as a capture note (and in
 * docs/baseball-pg-coverage.md), never faked.
 *
 * Outputs:
 *   - content/baseball/schedule.json — what the site reads. The existing
 *     shape is kept BACKWARD-COMPATIBLE: fields are only added, never
 *     renamed or removed.
 *   - content/baseball/pg-snapshots/YYYY-MM-DD.json — dated raw snapshot of
 *     the full capture (parsed data only, no HTML blobs), for backfill/diff.
 *
 * A fetch or parse failure on the CORE team page writes
 * content/baseball/schedule-error.json and exits non-zero, so callers keep
 * the last verified schedule rather than publishing a guess. Failures on
 * the auxiliary pages (event page, standings page) are non-fatal: the
 * affected fields are left null and a note is recorded, because a partial
 * capture is still better than no Thursday publish.
 *
 * Source: https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePoolStandingsPage } from '../cloudflare/baseball-standings.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'content', 'baseball');
const OUT_PATH = join(OUT_DIR, 'schedule.json');
const ERROR_PATH = join(OUT_DIR, 'schedule-error.json');
const SNAPSHOT_DIR = join(OUT_DIR, 'pg-snapshots');

const TEAM_URL = 'https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027';
const PG_BASE = 'https://www.perfectgame.org';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IDENTIFYING_UA = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';
const TIMEOUT = 45000;
const ATTEMPTS = 3;
const FETCH_GAP_MS = 1200; // politeness gap between auxiliary page fetches

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HEADER_SETS = [
  {
    'user-agent': BROWSER_UA,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
  },
  {
    'user-agent': IDENTIFYING_UA,
    accept: 'text/html,application/xhtml+xml',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
  },
];

/** Plain node fetch with browser-grade headers and retries, repo fetch pattern. */
async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const headers = HEADER_SETS[Math.min(attempt - 1, HEADER_SETS.length - 1)];
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) });
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
const nullIfEmpty = (value) => {
  const text = typeof value === 'string' ? value.trim() : value;
  return text === '' || text === undefined ? null : text;
};
const absolutize = (href, base = PG_BASE) => new URL(decodeEntities(href), base).toString();

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseMMDDYYYY(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognized tournament date: ${value}`);
  return { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) };
}

const isoDate = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Today's date in America/Chicago as YYYY-MM-DD (snapshot naming). */
function chicagoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Game rows say "Sep 26"; the year comes from the tournament's start date. */
function gameIsoDate(monthDay, tournamentStart) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2})$/.exec(monthDay.trim());
  if (!match) throw new Error(`Unrecognized game date: ${monthDay}`);
  const month = MONTHS[match[1]];
  if (!month) throw new Error(`Unrecognized game month: ${monthDay}`);
  let year = tournamentStart.year;
  if (tournamentStart.month === 12 && month === 1) year += 1;
  if (tournamentStart.month === 1 && month === 12) year -= 1;
  return isoDate({ year, month, day: Number(match[2]) });
}

function hiddenValue(block, name) {
  const match = new RegExp(`name="[^"]*\\$${name}"[^>]*value="([^"]*)"`, 'i').exec(block)
    ?? new RegExp(`id="[^"]*_${name}"[^>]*value="([^"]*)"`, 'i').exec(block);
  return match ? decodeEntities(match[1]) : null;
}

const normName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/* ------------------------------------------------------------ team metadata */

function parseTeam(html) {
  const name = /id="[^"]*lblOrgTeamName"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  const city = /id="[^"]*lblTeamHomeTown"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  const ageDivision = /id="[^"]*lblAgeDivision"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  const org = /id="[^"]*hlOrganizationName"[^>]*href="([^"]*)"[^>]*>([^<]*)</.exec(html);
  const membershipYear = /id="[^"]*lblAssociationYear"[^>]*>([^<]*)</.exec(html)?.[1]?.trim();
  if (!name) throw new Error('Team name not found on the Perfect Game team page.');
  return {
    name,
    city: city || null,
    age_division: ageDivision || null,
    // Perfect Game shows no team record or ranking on the team page; those
    // live behind postback links or in DiamondKast. Keep the fields honest.
    organization: org ? stripTags(org[2]) || null : null,
    organization_url: org ? absolutize(org[1]) : null,
    membership_year: membershipYear || null,
    record: null,
    ranking: null,
  };
}

/* ------------------------------------------------------------------- roster */

const ROSTER_COLUMNS = ['No', 'Name', 'Pos', 'B/T', 'Grad', 'Ht', 'Wt', 'HS', 'Hometown', 'Rank', 'Commitment'];

function parseRoster(html, notes) {
  const panelIdx = html.indexOf('pnlPlayerGrid');
  if (panelIdx === -1) {
    notes.push('Roster: FULL ROSTER panel not found on the team page; roster left empty.');
    return [];
  }
  const panel = html.slice(panelIdx, panelIdx + 120000);
  const headers = [...panel.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => stripTags(m[1]));
  if (headers.length === 0) {
    notes.push('Roster: no table headers found in the roster panel; roster left empty.');
    return [];
  }
  const indexOf = (label) => headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  const rows = [...panel.matchAll(/<tr class="(?:rgRow|rgAltRow)"[^>]*>([\s\S]*?)<\/tr>/g)];
  const players = rows.map((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const at = (label) => {
      const i = indexOf(label);
      return i === -1 ? null : nullIfEmpty(stripTags(cells[i] ?? ''));
    };
    const nameIdx = indexOf('Name');
    const nameLink = nameIdx === -1 ? null
      : /href="([^"]+)"/.exec(cells[nameIdx] ?? '')?.[1] ?? null;
    const gradRaw = at('Grad');
    const wtRaw = at('Wt');
    return {
      name: at('Name'),
      // Profile links are relative to the team page path
      // (../../Players/Playerprofile.aspx?ID=...), so resolve against TEAM_URL.
      player_url: nameLink ? absolutize(nameLink, TEAM_URL) : null,
      pos: at('Pos'),
      bt: at('B/T'),
      grad_year: gradRaw && /^\d{4}$/.test(gradRaw) ? Number(gradRaw) : null,
      ht: at('Ht'),
      wt: wtRaw && /^\d+$/.test(wtRaw) ? Number(wtRaw) : null,
      hs: at('HS'),
      hometown: at('Hometown'),
      rank: at('Rank'),
      commitment: at('Commitment'),
    };
  }).filter((p) => p.name);
  if (players.length === 0) {
    notes.push('Roster: roster panel found but no player rows parsed; roster left empty.');
  }
  return players;
}

/* ------------------------------------------------------------------ schedule */

function parseGame(cell, tournamentStart) {
  const text = (pattern) => {
    const match = pattern.exec(cell);
    return match ? stripTags(match[1]) : null;
  };
  const dateLabel = text(/id="[^"]*lblMonthDay"[^>]*>([\s\S]*?)</);
  const timeMatch = /(\d{1,2}:\d{2}\s*[AP]M)/.exec(stripTags(cell));
  const homeAwayRaw = text(/id="[^"]*lblHomeAway"[^>]*>([\s\S]*?)</);
  const opponentLink = /id="[^"]*hlOpponentName"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(cell);
  const opponent = opponentLink ? stripTags(opponentLink[2]) : text(/id="[^"]*hlOpponentName"[^>]*>([\s\S]*?)</);
  const recordRaw = text(/id="[^"]*lblOpponentRecord"[^>]*>([\s\S]*?)</);
  const pool = text(/id="[^"]*lblPool2"[^>]*>([\s\S]*?)</);
  const fieldRaw = text(/id="[^"]*lblField"[^>]*>([\s\S]*?)</);
  const venueLink = /id="[^"]*hlBallpark"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(cell);
  const venue = venueLink ? stripTags(venueLink[1]) : null;
  const dkMatch = /\/DiamondKast\/Game\.aspx\?gameid=(\d+)/.exec(cell);

  if (!dateLabel) throw new Error('Game row is missing its date.');
  if (!opponent) throw new Error(`Game row on ${dateLabel} is missing its opponent.`);

  const homeAway = homeAwayRaw?.replace(/\./g, '').trim();
  if (homeAway && homeAway !== '@' && homeAway !== 'vs') {
    throw new Error(`Unrecognized home/away marker: ${homeAwayRaw}`);
  }
  const field = fieldRaw ? fieldRaw.replace(/\s*@\s*$/, '').trim() || null : null;

  return {
    date: gameIsoDate(dateLabel, tournamentStart),
    time: timeMatch ? timeMatch[1].replace(/\s+/, ' ') : null,
    opponent,
    opponent_record: recordRaw ? recordRaw.replace(/[()]/g, '').trim() || null : null,
    opponent_url: opponentLink ? absolutize(opponentLink[1]) : null,
    home_away: homeAway || null,
    pool: pool || null,
    field,
    venue,
    diamondkast_url: dkMatch ? `${PG_BASE}/DiamondKast/Game.aspx?gameid=${dkMatch[1]}` : null,
    // Filled in from the event scoreboard below, once the game is final.
    result: null,
    result_status: null,
    runs_for: null,
    runs_against: null,
  };
}

function parseTournaments(html) {
  if (!/TEAM SCHEDULE/.test(html)) throw new Error('TEAM SCHEDULE section not found on the Perfect Game team page.');

  const eventLinks = [...html.matchAll(/<a[^>]*id="[^"]*hlEvent"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
  const gameCells = [...html.matchAll(/<td class="nestedscheduleGridRow">([\s\S]*?)<\/td>/g)];

  const tournaments = [];
  for (let i = 0; i < eventLinks.length; i += 1) {
    const link = eventLinks[i];
    // The tournament id and date-range hidden fields sit earlier in the same
    // header row, before the event link, so the block starts at the row.
    const blockStart = html.lastIndexOf('<tr class="rgRow"', link.index);
    const blockEnd = i + 1 < eventLinks.length ? eventLinks[i + 1].index : html.length;
    const block = html.slice(blockStart, blockEnd);

    const name = stripTags(link[2]);
    const eventUrl = absolutize(link[1]);
    const eventId = /event=(\d+)/.exec(link[1])?.[1] ?? null;
    const tournamentId = hiddenValue(block, 'hfTournamentID') ?? eventId;
    const startRaw = hiddenValue(block, 'hfStartDate');
    const endRaw = hiddenValue(block, 'hfEndDate');
    if (!tournamentId || !startRaw || !endRaw) {
      throw new Error(`Tournament "${name}" is missing its id or date range.`);
    }
    const start = parseMMDDYYYY(startRaw);
    const end = parseMMDDYYYY(endRaw);

    const datesMatch = /<br\s*\/?>\s*<span>([^<]+)<\/span>\s*<span[^>]*>([^<]+)<\/span>/.exec(block);
    const bracketMatch = /href="(\/events\/Brackets\.aspx\?event=\d+)"[^>]*>Bracket</.exec(block);

    const games = gameCells
      .filter((cell) => cell.index > blockStart && cell.index < blockEnd)
      .map((cell) => parseGame(cell[1], start));

    tournaments.push({
      name,
      dates: datesMatch ? stripTags(datesMatch[1]) : null,
      start_date: isoDate(start),
      end_date: isoDate(end),
      city: datesMatch ? stripTags(datesMatch[2]) : null,
      venue: games.find((game) => game.venue)?.venue ?? null,
      event_id: tournamentId,
      event_url: eventUrl,
      bracket_url: bracketMatch ? absolutize(bracketMatch[1]) : null,
      games,
      // Filled in from the tournament pages below (non-fatal if missing).
      event_location: null,
      event_address: null,
      divisions: [],
      standings_url: null,
      pool_standings: null,
      team_event_record: null,
      scoreboard: null,
    });
  }
  return tournaments;
}

/* ------------------------------------------------------- tournament pages */

function sbValue(html, prefix, field, n) {
  const match = new RegExp(`id="${prefix}_${field}_${n}"[^>]*>([\\s\\S]*?)<\\/(?:span|div)>`).exec(html);
  return match ? nullIfEmpty(stripTags(match[1])) : null;
}

/**
 * Public scoreboard on the event home page: every game tile (status games
 * first, then scheduled games), with visitor/home, runs, game status
 * (Final, Top/Bot N, or null when scheduled), date/time, venue, and the
 * DiamondKast game id. This is public page content, not the paywalled
 * DiamondKast game page itself.
 */
function parseEventScoreboard(html) {
  const prefix = 'ContentTopLevel_ContentPlaceHolder1_ucDiamondKast_dlScoreBoard';
  // Every game tile has a hlDiamondKastGames link; only started/final games
  // also render a status span, so enumerate on the link, not the status.
  const ids = [...html.matchAll(new RegExp(`id="${prefix}_hlDiamondKastGames_(\\d+)"`, 'g'))]
    .map((m) => Number(m[1]));
  return ids.map((n) => {
    const venueRaw = sbValue(html, prefix, 'divTournamentName', n);
    const linkMatch = new RegExp(`id="${prefix}_divgamelink_${n}"[^>]*>([\\s\\S]*?)<\\/div>`).exec(html);
    const gameId = linkMatch ? /gameid=(\d+)/.exec(linkMatch[1])?.[1] ?? null : null;
    const fieldSplit = venueRaw ? /^(.*?)\s+(Field\s+\d+.*)$/.exec(venueRaw) : null;
    const visRuns = sbValue(html, prefix, 'lblVisRuns', n);
    const homeRuns = sbValue(html, prefix, 'lblHomeRuns', n);
    const status = sbValue(html, prefix, 'lblGameStatus', n);
    const numOrNull = (raw) => {
      // Scheduled games render placeholder 0s; a real 0-0 always carries a
      // Final (or in-progress) status, so null the placeholders out.
      if (raw === null || !/^\d+$/.test(raw)) return null;
      return status === null && raw === '0' ? null : Number(raw);
    };
    return {
      game_id: gameId,
      diamondkast_url: gameId ? `${PG_BASE}/DiamondKast/Game.aspx?gameid=${gameId}` : null,
      status,
      datetime: sbValue(html, prefix, 'lblGameDateTime', n),
      visitor: sbValue(html, prefix, 'lblVisitorName', n),
      visitor_runs: numOrNull(visRuns),
      home: sbValue(html, prefix, 'lblHomeTeamName', n),
      home_runs: numOrNull(homeRuns),
      venue: fieldSplit ? fieldSplit[1].trim() : venueRaw,
      field: fieldSplit ? fieldSplit[2].trim() : null,
    };
  });
}

function parseEventPage(html, eventUrl) {
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1]?.trim().replace(/\s*\|\s*Perfect Game.*$/, '') ?? null;
  const dates = /id="[^"]*lblDatesNew"[^>]*>([^<]*)</.exec(html)?.[1]?.trim() || null;
  const loc = /id="[^"]*lblEventLocaGeneral"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(html);
  const locText = loc ? stripTags(loc[2]) : null;
  const divisions = [...html.matchAll(/id="[^"]*rptDivisions_hlDivisions_\d+"[^>]*>([^<]+)</g)]
    .map((m) => m[1].trim()).filter(Boolean);
  const standingsHref = /id="[^"]*hlTournamentPoolStandings"[^>]*href="([^"]+)"/.exec(html)?.[1] ?? null;
  return {
    event_name: title,
    event_url: eventUrl,
    dates,
    location: locText,
    address: loc ? /q=([^"&]+)/.exec(decodeEntities(loc[1]))?.[1]?.replace(/\+/g, ' ') ?? null : null,
    divisions,
    standings_url: standingsHref ? absolutize(standingsHref, `${PG_BASE}/events/`) : null,
    scoreboard_url: eventUrl,
    scoreboard: parseEventScoreboard(html),
  };
}

function parsePoolStandings(html, standingsUrl, teamName) {
  // Shared with the Worker poller (cloudflare/baseball-standings.mjs). Matches
  // only rptrPoolStandings control ids so DiamondKast scoreboard HTML on the
  // same page cannot corrupt seed/state/W-L cells.
  return parsePoolStandingsPage(html, { standingsUrl, teamName });
}

/** Join event-scoreboard results onto the team's schedule games by game id. */
function applyResults(tournaments, eventCaptures, teamName) {
  const byGameId = new Map();
  for (const capture of eventCaptures) {
    for (const sb of capture?.scoreboard ?? []) {
      if (sb.game_id) byGameId.set(sb.game_id, sb);
    }
  }
  for (const tournament of tournaments) {
    for (const game of tournament.games) {
      const gameId = /gameid=(\d+)/.exec(game.diamondkast_url ?? '')?.[1] ?? null;
      const sb = gameId ? byGameId.get(gameId) : null;
      if (!sb || !sb.visitor || !sb.home) continue;
      const isVisitor = normName(sb.visitor) === normName(teamName);
      const isHome = normName(sb.home) === normName(teamName);
      if (!isVisitor && !isHome) continue; // never guess which side is ours
      const runsFor = isVisitor ? sb.visitor_runs : sb.home_runs;
      const runsAgainst = isVisitor ? sb.home_runs : sb.visitor_runs;
      game.result_status = sb.status;
      game.runs_for = runsFor;
      game.runs_against = runsAgainst;
      if (sb.status === 'Final' && runsFor !== null && runsAgainst !== null) {
        const outcome = runsFor > runsAgainst ? 'W' : runsFor < runsAgainst ? 'L' : 'T';
        game.result = `${outcome} ${runsFor}-${runsAgainst}`;
      }
    }
  }
}

/* ------------------------------------------------------------------ output */

function writeError(error) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(ERROR_PATH, `${JSON.stringify({ scraped_at: new Date().toISOString(), error: String(error?.message ?? error) }, null, 2)}\n`);
  console.error(`baseball-pg: ${error?.message ?? error}`);
  process.exit(1);
}

async function captureTournament(tournament, teamName, notes) {
  const capture = { event_id: tournament.event_id };
  try {
    const eventHtml = await (await get(tournament.event_url)).text();
    if (eventHtml.length < 10000) throw new Error(`event page returned only ${eventHtml.length} bytes`);
    const event = parseEventPage(eventHtml, tournament.event_url);
    tournament.event_location = event.location;
    tournament.event_address = event.address;
    tournament.divisions = event.divisions;
    tournament.standings_url = event.standings_url;
    tournament.scoreboard = event.scoreboard;
    capture.event = event;
    await wait(FETCH_GAP_MS);
  } catch (error) {
    const note = `Event page capture failed for "${tournament.name}": ${error.message}`;
    notes.push(note);
    console.warn(`baseball-pg: ${note}`);
    return capture;
  }

  const standingsUrl = tournament.standings_url
    ?? `${PG_BASE}/events/TournamentPoolStandings.aspx?event=${tournament.event_id}`;
  tournament.standings_url = standingsUrl;
  try {
    await wait(FETCH_GAP_MS);
    const standingsHtml = await (await get(standingsUrl)).text();
    if (standingsHtml.length < 10000) throw new Error(`standings page returned only ${standingsHtml.length} bytes`);
    const standings = parsePoolStandings(standingsHtml, standingsUrl, teamName);
    tournament.pool_standings = standings.pools;
    tournament.team_event_record = standings.team_record;
    capture.standings = standings;
  } catch (error) {
    const note = `Pool standings capture failed for "${tournament.name}": ${error.message}`;
    notes.push(note);
    console.warn(`baseball-pg: ${note}`);
  }
  return capture;
}

async function main() {
  const notes = [];

  let html;
  try {
    html = await (await get(TEAM_URL)).text();
  } catch (error) {
    writeError(error);
    return;
  }
  if (html.length < 10000) {
    writeError(new Error(`Team page returned only ${html.length} bytes; the markup is not usable.`));
    return;
  }

  let team;
  let tournaments;
  let roster;
  try {
    team = parseTeam(html);
    roster = parseRoster(html, notes);
    tournaments = parseTournaments(html);
  } catch (error) {
    writeError(error);
    return;
  }

  // Auxiliary tournament pages: best-effort, never fatal to the run.
  const captures = [];
  for (const tournament of tournaments) {
    captures.push(await captureTournament(tournament, team.name, notes));
    await wait(FETCH_GAP_MS);
  }
  applyResults(tournaments, captures.map((c) => c.event).filter(Boolean), team.name);

  const scrapedAt = new Date().toISOString();
  const snapshotDate = chicagoDate();
  const payload = {
    scraped_at: scrapedAt,
    snapshot_date: snapshotDate,
    source: 'Perfect Game',
    source_url: TEAM_URL,
    team,
    roster,
    tournaments,
    capture_notes: notes,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const snapshotPath = join(SNAPSHOT_DIR, `${snapshotDate}.json`);
  writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);

  const gameCount = tournaments.reduce((sum, t) => sum + t.games.length, 0);
  const resultCount = tournaments.reduce(
    (sum, t) => sum + t.games.filter((g) => g.result).length, 0);
  console.log(`baseball-pg: wrote ${OUT_PATH} (${tournaments.length} tournament(s), ${gameCount} game(s), ${roster.length} roster player(s), ${resultCount} final result(s))`);
  console.log(`baseball-pg: wrote snapshot ${snapshotPath}`);
  for (const note of notes) console.log(`baseball-pg: note: ${note}`);
}

main();
