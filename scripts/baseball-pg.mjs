#!/usr/bin/env node
/**
 * Perfect Game schedule scraper for the 4:13 Baseball subsite.
 *
 * SCHEDULE ONLY. Player stats on Perfect Game are paywalled and this script
 * never touches them; it never invents games either. Every value below is read
 * from the team's public Perfect Game page and validated. A fetch or parse
 * failure writes content/baseball/schedule-error.json and exits non-zero, so
 * callers keep the last verified schedule rather than publishing a guess.
 *
 * Source: https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'content', 'baseball');
const OUT_PATH = join(OUT_DIR, 'schedule.json');
const ERROR_PATH = join(OUT_DIR, 'schedule-error.json');

const TEAM_URL = 'https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027';
const PG_BASE = 'https://www.perfectgame.org';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IDENTIFYING_UA = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';
const TIMEOUT = 45000;
const ATTEMPTS = 3;

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
const absolutize = (href) => new URL(decodeEntities(href), PG_BASE).toString();

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseMMDDYYYY(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Unrecognized tournament date: ${value}`);
  return { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) };
}

const isoDate = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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

function parseTeam(html) {
  const name = /id="[^"]*lblOrgTeamName"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  const city = /id="[^"]*lblTeamHomeTown"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  const ageDivision = /id="[^"]*lblAgeDivision"[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
  if (!name) throw new Error('Team name not found on the Perfect Game team page.');
  return { name, city: city || null, age_division: ageDivision || null };
}

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
    });
  }
  return tournaments;
}

function writeError(error) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(ERROR_PATH, `${JSON.stringify({ scraped_at: new Date().toISOString(), error: String(error?.message ?? error) }, null, 2)}\n`);
  console.error(`baseball-pg: ${error?.message ?? error}`);
  process.exit(1);
}

async function main() {
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

  let payload;
  try {
    payload = {
      scraped_at: new Date().toISOString(),
      source: 'Perfect Game',
      source_url: TEAM_URL,
      team: parseTeam(html),
      tournaments: parseTournaments(html),
    };
  } catch (error) {
    writeError(error);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  const gameCount = payload.tournaments.reduce((sum, t) => sum + t.games.length, 0);
  console.log(`baseball-pg: wrote ${OUT_PATH} (${payload.tournaments.length} tournament(s), ${gameCount} game(s))`);
}

main();
