/**
 * Perfect Game bracket parsing and normalization for the 4:13 Baseball subsite.
 *
 * Pure module: no Node APIs, no Worker APIs. Shared by the Cloudflare Worker
 * bracket poller (cloudflare/worker.mjs) and the one-shot GitHub Action
 * scraper (scripts/baseball-bracket.mjs) so both read the Brackets.aspx page
 * the same way.
 *
 * Page facts (verified 2026-09-26 against event 140434):
 * - One <table id="..._gvBracket"> per tier ("Gold Bracket", "Silver Bracket",
 *   "Bronze Bracket" render as plain text before each table).
 * - Team boxes: <td class="HomeTeamBox"> / <td class="VisitorTeamBox">.
 *   Boxes and game cells pair by slot number (SeedPos{N} / GamePos{N} in the
 *   control ids); table row order is NOT a reliable pairing because both
 *   bracket halves render side by side.
 * - Each box carries a seed label (lbl...SeedPos{N}_{i}, e.g. "#4"), a team
 *   link (hl...Pos{N}_{i}; "Seed #4" placeholder until pool play seeds it),
 *   and a score span (lbl...ScorePos{N}_{i}; empty until the game is final).
 * - Game cells: <td class="GameTopBox"> with a span like
 *   "GM: 20 | 9/27 | 8:00 AM<br />Field 7 @ Premier Baseball of Texas".
 * - Later rounds reference feeders as "Winner of Game #N" inside team names.
 *
 * Never invents games, teams, seeds or scores: everything returned is read
 * from the page. The winner is derived only when the page shows both scores
 * and they differ.
 */

export const PG_BASE = 'https://www.perfectgame.org';
export const BRACKET_URL_FOR = (eventId) => `${PG_BASE}/events/Brackets.aspx?event=${eventId}`;
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&rsquo;': '’' };
const decodeEntities = (value) => String(value ?? '').replace(/&(?:nbsp|amp|quot|#39|apos|rsquo);/g, (e) => ENTITIES[e] ?? e);
const stripTags = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** YYYY-MM-DD in America/Chicago for the given instant. */
export function chicagoDateString(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return parts; // en-CA yields YYYY-MM-DD
}

/**
 * Pick the tournament whose date range contains today (Chicago). Returns the
 * raw tournament object or null when no tournament covers this weekend.
 */
export function pickWeekendTournament(tournaments, now = new Date()) {
  const today = chicagoDateString(now);
  const list = Array.isArray(tournaments) ? tournaments : [];
  return list.find((t) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date) ?? null;
}

/* ------------------------------------------------------- bracket extraction */

const ROUND_LABELS = { 0: 'Championship', 1: 'Semifinal', 2: 'Quarterfinal', 3: 'Round of 16', 4: 'Round of 32' };

export function roundLabel(depth) {
  return ROUND_LABELS[depth] ?? `Round ${depth}`;
}

/** Score text -> integer, or null when the page shows no score. */
function parseScore(text) {
  const t = String(text ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Parse one gvBracket table. Returns games with structured teams:
 * { game_number, date, time, field, venue, home: {seed, name, score}, away: {...} }
 */
export function parseBracketTable(tableHtml, tournament) {
  const tournamentYear = tournament?.start_date ? Number(tournament.start_date.slice(0, 4)) : null;
  const boxes = new Map(); // slot -> {home:{seed,name,score}, away:{seed,name,score}}
  for (const match of tableHtml.matchAll(/<td class="(Home|Visitor)TeamBox">([\s\S]*?)<\/td>/g)) {
    const side = match[1] === 'Home' ? 'home' : 'away';
    const cell = match[2];
    const slot = /SeedPos(\d+)_\d+">/.exec(cell)?.[1];
    if (!slot) continue;
    const seed = stripTags(/SeedPos\d+_\d+">([^<]*)/.exec(cell)?.[1] ?? '').replace(/\s+/g, ' ').trim() || null;
    const name = stripTags(/hl(?:Home|Visitor)Pos\d+_\d+"[^>]*>([\s\S]*?)<\/a>/.exec(cell)?.[1] ?? '') || null;
    const score = parseScore(stripTags(/lbl(?:Home|Visitor)ScorePos\d+_\d+">([^<]*)/.exec(cell)?.[1] ?? ''));
    const entry = boxes.get(slot) ?? {};
    entry[side] = { seed, name, score };
    boxes.set(slot, entry);
  }

  const games = [];
  for (const match of tableHtml.matchAll(/<td class="GameTopBox"[^>]*>([\s\S]*?)<\/td>/g)) {
    const cell = match[1];
    const span = /GamePos(\d+)_\d+">([\s\S]*?)<\/span>/.exec(cell);
    if (!span) continue;
    const slot = span[1];
    const text = stripTags(span[2].replace(/<br\s*\/?>/gi, ' | '));
    const info = /^GM:\s*(\d+)\s*\|\s*(\d{1,2})\/(\d{1,2})\s*\|\s*(\d{1,2}:\d{2}\s*[AP]M)\s*\|\s*(.+)$/.exec(text);
    if (!info) throw new Error(`Unrecognized bracket game cell: "${text}"`);

    const [, gameNum, month, day, time, fieldVenue] = info;
    // Bracket games sit within days of the tournament start; only a
    // December/January boundary can shift the year.
    let year = tournamentYear;
    if (tournamentYear && tournament.start_date) {
      const startMonth = Number(tournament.start_date.slice(5, 7));
      const gameMonth = Number(month);
      if (startMonth === 12 && gameMonth === 1) year += 1;
      if (startMonth === 1 && gameMonth === 12) year -= 1;
    }
    const [fieldRaw, ...venueParts] = fieldVenue.split(/\s*@\s*/);
    const venue = venueParts.join(' @ ').trim() || null;
    const home = boxes.get(slot)?.home ?? { seed: null, name: null, score: null };
    const away = boxes.get(slot)?.away ?? { seed: null, name: null, score: null };
    games.push({
      game_number: Number(gameNum),
      date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      time: time.replace(/\s+/, ' '),
      field: fieldRaw.trim() || null,
      venue,
      home,
      away,
    });
  }
  return games;
}

/**
 * Parse the whole Brackets.aspx page. Returns
 * [{ tier: 'Gold Bracket' | ..., games: [...] }, ...].
 */
export function parseBracketsPage(html, tournament) {
  const tiers = [];
  const tableMatches = [...html.matchAll(/<table cellspacing="0" id="[^"]*_gvBracket"[^>]*>([\s\S]*?)<\/table>/g)];
  for (const tableMatch of tableMatches) {
    // The tier label ("Gold Bracket", ...) renders as plain text before the
    // table, but a per-bracket <style> block sits between them, so look
    // further back and strip style/script content first.
    const before = html.slice(Math.max(0, tableMatch.index - 4000), tableMatch.index)
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ');
    const tier = /((?:Gold|Silver|Bronze|Championship|Consolation)[^<]{0,20}Bracket)/i.exec(stripTags(before))?.[1] ?? null;
    tiers.push({ tier, games: parseBracketTable(tableMatch[1], tournament) });
  }
  return tiers;
}

/**
 * Round names from the page's own "Winner of Game #N" feeder references.
 * Depth 0 (no consumer) = Championship; each feeder level steps one round out.
 */
export function assignRounds(games) {
  const feeds = new Map(); // gameNumber -> consumer gameNumber
  for (const game of games) {
    for (const name of [game.home?.name, game.away?.name]) {
      if (!name) continue;
      for (const ref of name.matchAll(/Winner of Game #(\d+)/g)) {
        feeds.set(Number(ref[1]), game.game_number);
      }
    }
  }
  const depth = (num, seen = new Set()) => {
    if (seen.has(num)) return 0;
    seen.add(num);
    return feeds.has(num) ? 1 + depth(feeds.get(num), seen) : 0;
  };
  return games.map((game) => ({ ...game, round: roundLabel(depth(game.game_number)) }));
}

/**
 * Winner from the page's own scores: 'home' | 'away' | null. Null when a
 * score is missing, non-numeric, or tied — never inferred beyond the page.
 */
export function deriveWinner(game) {
  const h = game.home?.score;
  const a = game.away?.score;
  if (!Number.isInteger(h) || !Number.isInteger(a) || h === a) return null;
  return h > a ? 'home' : 'away';
}

/** Display string for one side: "Seed #4", "#4 4:13 Baseball", or "TBD". */
export function sideLabel(team) {
  const parts = [team?.seed, team?.name].filter(Boolean);
  if (parts.length === 0) return 'TBD';
  return parts.join(' ');
}

/**
 * Build the KV snapshot. Last-good semantics are enforced by the caller:
 * this is only written after a successful fetch+parse.
 */
export function buildSnapshot({ eventId, tournamentName, bracketUrl, tiers, scrapedAt }) {
  return {
    schemaVersion: 1,
    event_id: String(eventId),
    tournament: tournamentName ?? null,
    bracket_url: bracketUrl ?? null,
    tiers: tiers.map(({ tier, games }) => ({
      tier: tier ?? 'Bracket',
      games: games.map((game) => ({
        game_number: game.game_number,
        round: game.round ?? null,
        date: game.date ?? null,
        time: game.time ?? null,
        field: game.field ?? null,
        venue: game.venue ?? null,
        home: {
          seed: game.home?.seed ?? null,
          name: game.home?.name ?? null,
          score: Number.isInteger(game.home?.score) ? game.home.score : null,
        },
        away: {
          seed: game.away?.seed ?? null,
          name: game.away?.name ?? null,
          score: Number.isInteger(game.away?.score) ? game.away.score : null,
        },
        winner: deriveWinner(game),
      })),
    })),
    game_count: tiers.reduce((n, t) => n + t.games.length, 0),
    scraped_at: scrapedAt,
    source: 'Perfect Game',
  };
}
