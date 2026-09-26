import publication from '../config/publication.json' with { type: 'json' };
import schedule from '../config/season-2026.json' with { type: 'json' };
import snapshot from '../public/live-score.json' with { type: 'json' };
import baseballSchedule from '../content/baseball/schedule.json' with { type: 'json' };
import { activeGame, gameSlug, fetchGameScore } from './score.mjs';
import {
  BRACKET_URL_FOR,
  BROWSER_UA,
  assignRounds,
  buildSnapshot,
  parseBracketsPage,
  pickWeekendTournament,
} from './baseball-bracket.mjs';

const keyFor = slug => `${publication.schoolId}:${slug}`;
const metaKeyFor = slug => `${publication.schoolId}:${slug}:ingest`;
/** A live score with no successful ingest for this long is reported as stale. */
const STALE_AFTER_MS = 10 * 60 * 1000;
/** Hostname of the 4:13 Baseball subsite (15U travel baseball, Spring TX). */
const BASEBALL_HOSTNAME = '413baseball.gameday.report';
/** Workers AI vision model used to transcribe box-score screenshots. */
const BOXSCORE_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

async function readScore(env, slug) {
  const saved = await env.SCORES.get(keyFor(slug), 'json');
  return saved || (snapshot.slug === slug ? snapshot : null);
}

export function scoreIsStale(score, now = Date.now()) {
  if (!score || score.status !== 'live') return false;
  const updated = Date.parse(score.updatedAt);
  return Number.isFinite(updated) && now - updated > STALE_AFTER_MS;
}

/** Heartbeat cadence for successful ingests; failures and recoveries always record. */
const INGEST_HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * Lightweight health signal for the score ingest. Every cron attempt records
 * when it ran, when it last succeeded, and the latest error plus a consecutive
 * failure count. Failures never overwrite the last good score in KV; they are
 * recorded here so a watcher can alert instead of the freeze going unnoticed.
 * Steady-state successes only heartbeat every few minutes so game-night write
 * volume stays inside the free KV quota; failures and recoveries always write.
 * Telemetry writes are best-effort and can never break the ingest itself.
 */
async function recordIngestAttempt(env, slug, ok, detail, now = Date.now()) {
  try {
    const key = metaKeyFor(slug);
    const prev = (await env.SCORES.get(key, 'json')) || {};
    const failures = prev.consecutiveFailures ?? 0;
    const lastAttempt = prev.lastAttempt ? Date.parse(prev.lastAttempt) : 0;
    if (ok && failures === 0 && prev.lastSuccess && now - lastAttempt < INGEST_HEARTBEAT_MS) return;
    await env.SCORES.put(key, JSON.stringify({
      slug,
      lastAttempt: new Date(now).toISOString(),
      lastSuccess: ok ? detail : (prev.lastSuccess ?? null),
      lastError: ok ? null : String(detail),
      consecutiveFailures: ok ? 0 : failures + 1,
    }));
  } catch {
    // Telemetry must never break the ingest.
  }
}

/** Constant-time string comparison so the box-score upload password can't be probed by timing. */
function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ''));
  const y = new TextEncoder().encode(String(b ?? ''));
  const n = Math.max(x.length, y.length);
  let diff = 0;
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 && x.length === y.length;
}

/**
 * Best-effort throttle on failed box-score password attempts: more than 10
 * failures from one IP in 5 minutes yields 429. LIMITATION: this map lives in
 * memory on a single isolate, so it is not shared across Workers instances
 * and resets on cold start. It blunts casual guessing, not a determined
 * distributed attack. A successful login clears the IP's failure count.
 */
const AUTH_WINDOW_MS = 5 * 60 * 1000;
const AUTH_MAX_FAILURES = 10;
/** ip -> number[] of failure timestamps (ms). */
const authFailures = new Map();

function authFailureCount(ip, now = Date.now()) {
  const recent = (authFailures.get(ip) ?? []).filter(t => now - t < AUTH_WINDOW_MS);
  authFailures.set(ip, recent);
  return recent.length;
}

/**
 * Password gate for box-score uploads and edits. Returns a failure Response,
 * or null when the supplied password matches env.BOXSCORE_PASSWORD. The
 * password is never logged and never echoed back in responses.
 */
function passwordGate(request, env, supplied) {
  if (!env.BOXSCORE_PASSWORD) return json({ error: 'uploads not configured' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (authFailureCount(ip) >= AUTH_MAX_FAILURES) {
    return json({ error: 'Too many failed attempts. Try again later.' }, 429);
  }
  if (!timingSafeEqual(supplied ?? '', env.BOXSCORE_PASSWORD)) {
    authFailures.set(ip, [...(authFailures.get(ip) ?? []), Date.now()]);
    return json({ error: 'Unauthorized' }, 401);
  }
  authFailures.delete(ip);
  return null;
}

/** Coerce a model-extracted stat to a safe integer (0 when missing/non-numeric). */
const toInt = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/**
 * Pull the first JSON object out of a model text response, tolerating
 * markdown fences and surrounding prose.
 */
function extractJsonObject(text) {
  const raw = String(text ?? '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object in model response');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Seed roster used to guide the vision model when the D1 players table is not
 * yet populated. Keep in sync with scripts/baseball-seed.mjs.
 */
const BASEBALL_SEED_NAMES = [
  'Hayden Baker', 'Teagan Barnes', 'Rick Delgadillo', 'Tyler Grisham', 'Ethan Hale',
  'Caden Koehn', 'Jayden Lange', 'Elijah Layton', 'Luke Layton', 'Landon Morris',
  'Bruce Novacek', 'Hampton Travis', 'Weston Travis', 'Levi Vannoy', 'Grayson Yates',
];

async function baseballRosterNames(env) {
  try {
    if (!env.BASEBALL_STATS) return BASEBALL_SEED_NAMES;
    const { results } = await env.BASEBALL_STATS.prepare('SELECT name, jersey_number FROM players ORDER BY name').all();
    if (!results.length) return BASEBALL_SEED_NAMES;
    return results.map(r => (Number.isInteger(r.jersey_number) ? `${r.name} (#${r.jersey_number})` : r.name));
  } catch {
    return BASEBALL_SEED_NAMES;
  }
}

/**
 * Vision prompt for the GameChanger box-score screenshots Steven uploads.
 * One game = up to two screenshots (batting view + pitching view); the model
 * reads all of them and merges them into a single game record.
 *
 * GameChanger layout facts the prompt relies on:
 * - Header: date ("Thu, Jul 16"), team names ("4:13 Baseb..." 9 FINAL 10
 *   "Slammers N..."), and a line score with inning-by-inning runs plus R/H/E
 *   totals. Our (4:13's) score is on the left.
 * - Batting LINEUP table columns: AB, R, H, RBI, BB, SO. Player cells look
 *   like "L Morris #42 (SS)": first initial, last name, jersey number, position.
 * - Extra batting lines below the table: 2B:, 3B:, HR:, TB: (total bases),
 *   HBP:, SF:, SB:, CS:, E:.
 * - Pitching table columns: IP, H, R, ER, BB, SO. (W)/(L)/(SV) after the name
 *   marks the decision.
 * - Extra pitching lines: HBP:, "Pitches-Strikes: Name 87-46", "Batters Faced:".
 * - Player names are truncated in the UI ("H Hoeg...r #14", "L Bartko...#37"),
 *   so matching runs on JERSEY NUMBER first, fuzzy last name second.
 */
function boxscorePrompt(rosterNames, imageCount) {
  const shape = '{"game":{"date":null,"opponent":null,"our_score":null,"opp_score":null,"result":null},'
    + '"batting":[{"jersey":null,"last_name":"","first_initial":"","pos":null,"ab":0,"r":0,"h":0,"1b":0,"2b":0,"3b":0,"hr":0,"rbi":0,"bb":0,"k":0,"sb":0,"cs":0,"hbp":0,"sf":0,"sac":0,"e":0}],'
    + '"pitching":[{"jersey":null,"last_name":"","first_initial":"","ip":0,"h":0,"r":0,"er":0,"bb":0,"k":0,"hr":0,"hbp":0,"wp":0,"bf":0,"pitches":0,"strikes":0,"w":0,"l":0,"sv":0}],'
    + '"uncertain":[]}';
  return 'You are a baseball box-score transcriber for 4:13 Baseball, a 15U travel baseball team from Spring, Texas. '
    + `You are shown ${imageCount} screenshot${imageCount === 1 ? '' : 's'} from the GameChanger app: the batting box-score view and/or the pitching box-score view for ONE game. `
    + 'Read all of them and combine what you see into one game record. Return ONLY a single JSON object, no markdown fences and no commentary, with this exact shape:\n'
    + shape + '\n'
    + 'Layout guide:\n'
    + '- Header: the game date (e.g. "Thu, Jul 16"), our team name "4:13 Baseball" (often truncated, e.g. "4:13 Baseb..."), the word FINAL, and the final score with OUR score on the left. Below is the line score: inning-by-inning runs plus R/H/E totals. our_score is 4:13\'s R total, opp_score is the opponent\'s R total, opponent is the other team\'s full name (expand obvious truncations), date is YYYY-MM-DD using the current year when the year is not shown. result is "W", "L" or "T" followed by the score in OUR-score-first order, e.g. "W 10-9" or "L 9-10".\n'
    + '- Batting "LINEUP" table columns: AB, R, H, RBI, BB, SO. Player cells look like "L Morris #42 (SS)": first initial, last name, jersey number after #, position in parentheses. Names are often truncated with "..." (e.g. "H Hoeg...r #14").\n'
    + '- Below the batting table are extra stat lines: "2B:" (doubles), "3B:" (triples), "HR:" when shown, "TB:" (total bases per player), "HBP:", "SF:", "SB:", "CS:", "E:" (errors). A bare name in these lines means 1, e.g. "SB: P McCain 2" means 2 stolen bases.\n'
    + '- Splitting hits: TB = 1B + 2*2B + 3*3B + 4*HR and H = 1B + 2B + 3B + HR. Use explicit 2B:/3B:/HR: lines when present; otherwise derive 2B = TB - H - 2*3B - 3*HR, then 1B = H - 2B - 3B - HR. Every row\'s 1b+2b+3b+hr must equal its h. If a row has no TB line and no explicit 2B/3B, set 1b/2b/3b to 0 and flag the row in "uncertain".\n'
    + '- Pitching "PITCHING" table columns: IP, H, R, ER, BB, SO. A (W), (L) or (SV) after the name marks the decision. Below the table: "HBP:", "Pitches-Strikes: Name 87-46" (pitches first, strikes second), "Batters Faced: Name 22".\n'
    + '- Ignore TEAM total rows; include one batting row per player who batted and one pitching row per pitcher who threw.\n'
    + 'Player matching: the primary key is the JERSEY NUMBER. Match last names fuzzily second (a truncated "Hoeg...r" matches "Hoegemeyer" when the jersey matches). Candidates, with jersey numbers in parentheses when known:\n'
    + rosterNames.join(', ') + '\n'
    + 'If a player cannot be matched confidently by jersey or name, still include their row with your best reading and add {"player":"<as shown>","jersey":<number or null>,"reason":"<why>"} to "uncertain".\n'
    + 'Rules: every stat is an integer except ip, which is baseball-decimal innings pitched (5.2 = 5 and 2/3 innings). Use null for any game field you cannot read; use empty arrays when a whole section is missing from the screenshots.';
}

/** ArrayBuffer -> base64 without blowing the call stack on large images. */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const BAT_STAT_FIELDS = ['ab', 'r', 'h', '1b', '2b', '3b', 'hr', 'rbi', 'bb', 'k', 'sb', 'cs', 'hbp', 'sf', 'sac', 'e'];
const PITCH_STAT_FIELDS = ['h', 'r', 'er', 'bb', 'k', 'hr', 'hbp', 'wp', 'bf', 'w', 'l', 'sv', 'pitches', 'strikes'];
const round3 = v => Math.round(v * 1000) / 1000;

/** Quote SQL identifiers that start with a digit ("1b", "2b", "3b"). */
const quoteIdent = f => (/^[0-9]/.test(f) ? `"${f}"` : f);

/** Coerce a model- or client-supplied jersey number to an integer or null. */
const toJersey = v => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Build the "F Lastname" display name from a parsed player row. */
function lineDisplayName(line) {
  const fi = String(line.first_initial ?? '').trim();
  const ln = String(line.last_name ?? '').trim();
  const full = `${fi} ${ln}`.trim();
  return full || String(line.player ?? '').trim() || 'Unknown';
}

/**
 * SHARED WRITE PATH for every box-score save (confirm endpoint and
 * PUT /api/baseball/games/:id/lines). REPLACEMENT semantics: deletes all
 * existing batting/pitching lines for the game, then inserts the new set.
 *
 * Player resolution: case-insensitive display-name match first, then
 * jersey-number match, then the roster grows automatically (pos 'UT').
 * A jersey number supplied on the line is stored on the player row so the
 * roster accumulates jerseys from uploads (the PG roster has none).
 * Returns { newPlayers } — names added to the roster by this save.
 */
async function writeGameLines(db, gameId, batting, pitching) {
  const { results: players } = await db.prepare('SELECT id, name, jersey_number FROM players').all();
  const byName = new Map(players.map(p => [String(p.name).toLowerCase(), p]));
  const byJersey = new Map();
  for (const p of players) {
    if (Number.isInteger(p.jersey_number)) byJersey.set(p.jersey_number, p);
  }
  const newPlayers = [];

  const resolvePlayer = async line => {
    const display = String(line.player ?? '').trim() || lineDisplayName(line);
    const key = display.toLowerCase();
    const jersey = toJersey(line.jersey);
    let row = byName.get(key);
    if (!row && jersey !== null && byJersey.has(jersey)) row = byJersey.get(jersey);
    if (!row) {
      const inserted = await db.prepare('INSERT INTO players (name, pos, grad_year, jersey_number) VALUES (?, ?, ?, ?)')
        .bind(display, 'UT', null, jersey).run();
      const id = Number(inserted.meta.last_row_id);
      row = { id, name: display, jersey_number: jersey };
      byName.set(key, row);
      if (jersey !== null) byJersey.set(jersey, row);
      if (!newPlayers.includes(display)) newPlayers.push(display);
    } else if (jersey !== null && row.jersey_number !== jersey) {
      // Latest confirmed value wins so re-uploads can correct a bad number.
      await db.prepare('UPDATE players SET jersey_number = ? WHERE id = ?').bind(jersey, row.id).run();
      if (row.jersey_number !== null) byJersey.delete(row.jersey_number);
      row.jersey_number = jersey;
      byJersey.set(jersey, row);
    }
    return row.id;
  };

  const statements = [
    db.prepare('DELETE FROM batting_lines WHERE game_id = ?').bind(gameId),
    db.prepare('DELETE FROM pitching_lines WHERE game_id = ?').bind(gameId),
  ];
  const batCols = BAT_STAT_FIELDS.map(quoteIdent).join(', ');
  for (const line of batting) {
    const playerId = await resolvePlayer(line);
    const values = [gameId, playerId, ...BAT_STAT_FIELDS.map(f => toInt(line[f]))];
    statements.push(db.prepare(
      `INSERT INTO batting_lines (game_id, player_id, ${batCols}) VALUES (${values.map(() => '?').join(', ')})`,
    ).bind(...values));
  }
  const pitchCols = PITCH_STAT_FIELDS.map(quoteIdent).join(', ');
  for (const line of pitching) {
    const playerId = await resolvePlayer(line);
    const values = [gameId, playerId, Number(line.ip) || 0, ...PITCH_STAT_FIELDS.map(f => toInt(line[f]))];
    statements.push(db.prepare(
      `INSERT INTO pitching_lines (game_id, player_id, ip, ${pitchCols}) VALUES (${values.map(() => '?').join(', ')})`,
    ).bind(...values));
  }
  await db.batch(statements);
  return { newPlayers };
}

/**
 * Convert baseball-decimal IP (5.2 = 5 and 2/3 innings) to true innings as a
 * fraction. Aggregates must be summed in thirds (outs), never as decimals.
 */
function ipToTrue(ip) {
  const v = Number(ip) || 0;
  const full = Math.floor(v);
  const thirds = Math.round((v - full) * 10);
  return full + thirds / 3;
}

/** True innings (fraction) back to baseball-decimal notation, e.g. 16/3 -> 5.1. */
function trueToIpDecimal(ipTrue) {
  const thirds = Math.round(ipTrue * 3);
  return Math.floor(thirds / 3) + (thirds % 3) / 10;
}

/** Cron string for the 4:13 Baseball bracket poller (every 15 minutes). */
const BRACKET_POLL_CRON = '*/15 * * * *';
/** KV key for a tournament's bracket snapshot: baseball:bracket:<event_id>. */
const BRACKET_KV_PREFIX = 'baseball:bracket:';

function chicagoTimeParts(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(ts);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    weekday: get('weekday'),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

async function fetchBracketHtml(url, timeoutMs = 45000) {
  const response = await fetch(url, {
    headers: {
      'user-agent': BROWSER_UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Bracket page returned HTTP ${response.status}`);
  return response.text();
}

/**
 * Telemetry for the bracket poll. Failures are recorded here and never touch
 * the last-good snapshot in KV. Best-effort: telemetry can never break the poll.
 */
async function recordBracketIngest(env, metaKey, ok, detail) {
  try {
    const prev = (await env.SCORES.get(metaKey, 'json')) || {};
    await env.SCORES.put(metaKey, JSON.stringify({
      lastAttempt: new Date().toISOString(),
      lastSuccess: ok ? detail : (prev.lastSuccess ?? null),
      lastError: ok ? null : String(detail),
      consecutiveFailures: ok ? 0 : (prev.consecutiveFailures ?? 0) + 1,
    }));
  } catch {
    // Telemetry must never break the poll.
  }
}

/**
 * 4:13 Baseball bracket poller. Runs on the BRACKET_POLL_CRON schedule:
 * every 15 minutes during Sat/Sun game hours (7am-11pm CT), hourly otherwise.
 * Fetches the weekend tournament's Perfect Game bracket page, normalizes it
 * into a snapshot, and stores it in KV. Last-good semantics: the snapshot is
 * only written after a successful fetch+parse, so a Perfect Game blip can
 * never wipe good data. A failure records telemetry and rethrows so the
 * invocation shows as failed in the Cloudflare dashboard — nothing fails
 * silently. Never invents scores, seeds or games.
 */
async function pollBaseballBracket(env, scheduledTime) {
  const now = new Date(scheduledTime);
  const { weekday, hour, minute } = chicagoTimeParts(now);
  const inGameWindow = (weekday === 'Sat' || weekday === 'Sun') && hour >= 7 && hour < 23;
  if (!inGameWindow && minute !== 0) return; // Off-hours: hourly is enough.
  const tournaments = Array.isArray(baseballSchedule?.tournaments) ? baseballSchedule.tournaments : [];
  const tournament = pickWeekendTournament(tournaments, now);
  if (!tournament?.event_id) return; // No tournament this weekend: nothing to poll.
  const eventId = String(tournament.event_id);
  const bracketUrl = tournament.bracket_url || BRACKET_URL_FOR(eventId);
  const key = `${BRACKET_KV_PREFIX}${eventId}`;
  try {
    const html = await fetchBracketHtml(bracketUrl);
    const tiers = parseBracketsPage(html, tournament)
      .map(({ tier, games }) => ({ tier, games: assignRounds(games) }));
    const gameCount = tiers.reduce((n, t) => n + t.games.length, 0);
    if (gameCount === 0) throw new Error('Bracket page published no bracket games yet');
    const snapshot = buildSnapshot({
      eventId,
      tournamentName: tournament.name ?? null,
      bracketUrl,
      tiers,
      scrapedAt: new Date().toISOString(),
    });
    await env.SCORES.put(key, JSON.stringify(snapshot));
    await recordBracketIngest(env, `${key}:ingest`, true, snapshot.scraped_at);
  } catch (err) {
    await recordBracketIngest(env, `${key}:ingest`, false, err instanceof Error ? err.message : err);
    throw err;
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === publication.domain) {
      const isStaticAsset = url.pathname.startsWith('/favicon')
        || url.pathname === '/apple-touch-icon.png'
        || url.pathname === '/site.webmanifest'
        || url.pathname === '/robots.txt';
      if (isStaticAsset && env.ASSETS) {
        const assetUrl = new URL(request.url);
        assetUrl.hostname = publication.schoolHostname;
        return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      }
      url.hostname = publication.schoolHostname;
      return Response.redirect(url.toString(), 301);
    }
    // 4:13 Baseball subsite: serve the same build's /baseball/* pages under
    // 413baseball.gameday.report. Paths already scoped to /baseball/* or /api/*
    // are left untouched; everything else is rewritten before the football
    // routes and the ASSETS fallthrough.
    const isBaseballHost = url.hostname === BASEBALL_HOSTNAME;
    if (url.hostname !== publication.schoolHostname && !isBaseballHost && !url.hostname.endsWith('.workers.dev')
      && !['localhost', '127.0.0.1'].includes(url.hostname)) return new Response('School not found', { status: 404 });

    if (isBaseballHost && !url.pathname.startsWith('/api/')
      && url.pathname !== '/baseball' && !url.pathname.startsWith('/baseball/')
      && url.pathname !== '/favicon.ico' && !url.pathname.startsWith('/_next/')
      && !/\/[^/]*\.[a-z0-9]+$/i.test(url.pathname)) {
      // Static assets (/_next/*, /brand/*, /videos/*, etc.) must NOT be
      // rewritten — they live at the same paths in the build output.
      url.pathname = url.pathname === '/' ? '/baseball' : `/baseball${url.pathname}`;
    }

    // /team was the program page for one deploy before it moved to /.
    if (url.pathname === '/team' || url.pathname === '/team/') {
      url.pathname = '/';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/api/score') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      const slug = url.searchParams.get('game') || snapshot.slug;
      if (!schedule.some(game => gameSlug(game) === slug)) return json({ error: 'Game not found' }, 404);
      try {
        const score = await readScore(env, slug);
        if (!score) return json({ error: 'Score not available yet' }, 404);
        // `stale` lets the frontend and any watcher see a frozen feed instead
        // of silently serving an old live score as current.
        return json({ ...score, stale: scoreIsStale(score), asOf: score.updatedAt ?? null });
      } catch {
        return snapshot.slug === slug ? json(snapshot) : json({ error: 'Score temporarily unavailable' }, 503);
      }
    }

    if (url.pathname === '/api/score/health') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      const slug = url.searchParams.get('game') || snapshot.slug;
      if (!schedule.some(game => gameSlug(game) === slug)) return json({ error: 'Game not found' }, 404);
      try {
        const [score, meta] = await Promise.all([
          readScore(env, slug).catch(() => null),
          env.SCORES.get(metaKeyFor(slug), 'json').catch(() => null),
        ]);
        return json({
          slug,
          scoreStatus: score?.status ?? null,
          stale: scoreIsStale(score),
          asOf: score?.updatedAt ?? null,
          lastAttempt: meta?.lastAttempt ?? null,
          lastSuccess: meta?.lastSuccess ?? null,
          lastError: meta?.lastError ?? null,
          consecutiveFailures: meta?.consecutiveFailures ?? 0,
        });
      } catch {
        return json({ error: 'Health check temporarily unavailable' }, 503);
      }
    }

    if (url.pathname === '/api/score/override') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.SCORE_ADMIN_TOKEN || request.headers.get('authorization') !== `Bearer ${env.SCORE_ADMIN_TOKEN}`) {
        return json({ error: 'Unauthorized' }, 401);
      }
      let input;
      try {
        const body = await request.text();
        if (body.length > 2048) return json({ error: 'Request too large' }, 413);
        input = JSON.parse(body);
      } catch { return json({ error: 'Invalid JSON' }, 400); }
      const game = schedule.find(game => game.date === input.date);
      if (!game || !['live', 'final'].includes(input.status)
        || ![input.homeScore, input.awayScore].every(n => Number.isInteger(n) && n >= 0 && n <= 200)) {
        return json({ error: 'Provide a scheduled date, live/final status and integer home/away scores.' }, 400);
      }
      const slug = gameSlug(game);
      const previous = await readScore(env, slug);
      const score = {
        schemaVersion: 1, slug, status: input.status,
        statusLabel: input.status === 'final' ? 'Final' : 'Live',
        homeScore: input.homeScore, awayScore: input.awayScore,
        homeRecord: previous?.homeRecord || '', awayRecord: previous?.awayRecord || '',
        updatedAt: new Date().toISOString(), source: 'Manual correction',
        sourceUrl: `https://${publication.schoolHostname}/`,
        manualUntil: Date.now() + 15 * 60 * 1000,
      };
      await env.SCORES.put(keyFor(slug), JSON.stringify(score));
      return json(score);
    }
    // ---- 4:13 Baseball box-score API (stats come from manual screenshot uploads) ----

    if (url.pathname === '/api/baseball/boxscore') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      let form;
      try {
        form = await request.formData();
      } catch {
        return json({ error: 'Invalid multipart form' }, 400);
      }
      const auth = passwordGate(request, env, form.get('password'));
      if (auth) return auth;
      // Multi-image aware: one game = up to two GameChanger screenshots
      // (batting view + pitching view), sent as images[] (or repeated images).
      // The legacy single `image` field keeps working.
      const images = [];
      const pushFile = f => {
        if (f && typeof f.arrayBuffer === 'function') images.push(f);
      };
      pushFile(form.get('image'));
      for (const f of form.getAll('images[]')) pushFile(f);
      for (const f of form.getAll('images')) pushFile(f);
      if (images.length === 0) {
        return json({ error: 'Provide at least one image file.' }, 400);
      }
      if (images.length > 4) return json({ error: 'Too many images (4 max).' }, 413);
      let gameId = null;
      const rawGameId = String(form.get('game_id') ?? '').trim();
      if (rawGameId !== '') {
        gameId = Number(rawGameId);
        if (!Number.isInteger(gameId) || gameId <= 0) return json({ error: 'game_id must be a positive integer.' }, 400);
      }
      if (!env.AI || typeof env.AI.run !== 'function') {
        return json({ error: 'Box-score extraction failed', message: 'Workers AI binding not configured' }, 502);
      }
      const rosterNames = await baseballRosterNames(env);
      const parts = [{ type: 'text', text: boxscorePrompt(rosterNames, images.length) }];
      try {
        for (const image of images) {
          const bytes = await image.arrayBuffer();
          if (bytes.byteLength === 0) return json({ error: 'Image file is empty.' }, 400);
          if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: 'Image too large (10 MB max).' }, 413);
          const contentType = image.type || 'image/png';
          parts.push({
            type: 'image_url',
            image_url: { url: `data:${contentType};base64,${arrayBufferToBase64(bytes)}` },
          });
        }
      } catch (err) {
        return json({ error: 'Could not read the image files', message: err instanceof Error ? err.message : String(err) }, 400);
      }
      let parsed;
      try {
        const aiOut = await env.AI.run(BOXSCORE_VISION_MODEL, {
          messages: [{ role: 'user', content: parts }],
        });
        const text = typeof aiOut === 'string' ? aiOut : aiOut?.response;
        parsed = extractJsonObject(text);
      } catch (err) {
        return json({ error: 'Box-score extraction failed', message: err instanceof Error ? err.message : String(err) }, 502);
      }
      const batting = (Array.isArray(parsed.batting) ? parsed.batting : []).map(line => {
        const row = { player: lineDisplayName(line), jersey: toJersey(line.jersey), pos: String(line.pos ?? '').trim() || null };
        for (const f of BAT_STAT_FIELDS) row[f] = toInt(line[f]);
        return row;
      });
      const pitching = (Array.isArray(parsed.pitching) ? parsed.pitching : []).map(line => {
        const row = {
          player: lineDisplayName(line), jersey: toJersey(line.jersey), pos: String(line.pos ?? '').trim() || null,
          ip: Number(line.ip) || 0,
        };
        for (const f of PITCH_STAT_FIELDS) row[f] = toInt(line[f]);
        return row;
      });
      const uncertain = (Array.isArray(parsed.uncertain) ? parsed.uncertain : []).map(u => ({
        player: String(u?.player ?? '').trim(),
        jersey: toJersey(u?.jersey),
        reason: String(u?.reason ?? '').trim(),
      })).filter(u => u.player !== '');
      const gameFields = ['date', 'opponent', 'tournament', 'venue', 'result'];
      const modelGame = parsed.game && typeof parsed.game === 'object' ? parsed.game : {};
      const game = { id: gameId };
      for (const f of gameFields) {
        const formKey = f === 'date' ? 'game_date' : f;
        const formVal = String(form.get(formKey) ?? '').trim();
        const modelVal = modelGame[f] === undefined || modelGame[f] === null ? null : String(modelGame[f]).trim() || null;
        game[f] = formVal !== '' ? formVal : modelVal;
      }
      // Scores come only from the screenshot header; there is no form field.
      game.our_score = modelGame.our_score === undefined || modelGame.our_score === null ? null : toInt(modelGame.our_score);
      game.opp_score = modelGame.opp_score === undefined || modelGame.opp_score === null ? null : toInt(modelGame.opp_score);
      let alreadyExists = false;
      if (gameId !== null && env.BASEBALL_STATS) {
        try {
          const [bl, pl] = await Promise.all([
            env.BASEBALL_STATS.prepare('SELECT COUNT(*) AS n FROM batting_lines WHERE game_id = ?').bind(gameId).first(),
            env.BASEBALL_STATS.prepare('SELECT COUNT(*) AS n FROM pitching_lines WHERE game_id = ?').bind(gameId).first(),
          ]);
          alreadyExists = (bl?.n ?? 0) > 0 || (pl?.n ?? 0) > 0;
        } catch {
          // A lookup failure must not block the parse response.
        }
      }
      return json({ game, batting, pitching, uncertain, already_exists: alreadyExists });
    }

    if (url.pathname === '/api/baseball/boxscore/confirm') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const auth = passwordGate(request, env, body.password);
      if (auth) return auth;
      if (!env.BASEBALL_STATS) return json({ error: 'stats database not configured' }, 503);
      const db = env.BASEBALL_STATS;
      const input = body.game && typeof body.game === 'object' ? body.game : {};
      const batting = Array.isArray(body.batting) ? body.batting : [];
      const pitching = Array.isArray(body.pitching) ? body.pitching : [];
      let gameId = input.id ?? null;
      if (gameId !== null && (!Number.isInteger(gameId) || gameId <= 0)) {
        return json({ error: 'game.id must be a positive integer or null.' }, 400);
      }
      let replaced = false;
      let newPlayers = [];
      try {
        if (gameId === null) {
          const inserted = await db.prepare(
            'INSERT INTO games (date, opponent, tournament, venue, result) VALUES (?, ?, ?, ?, ?)',
          ).bind(input.date ?? null, input.opponent ?? null, input.tournament ?? null, input.venue ?? null, input.result ?? null).run();
          gameId = Number(inserted.meta.last_row_id);
        } else {
          const existing = await db.prepare('SELECT id, date, opponent, tournament, venue, result FROM games WHERE id = ?').bind(gameId).first();
          if (!existing) return json({ error: 'Game not found' }, 404);
          // Replacement also refreshes the game meta (date, opponent, result…)
          // so a corrected re-upload fixes the header, not just the lines.
          // Only keys present in the request overwrite; absent keys keep
          // their current value.
          const pick = k => (k in input ? (input[k] ?? null) : existing[k]);
          await db.prepare(
            'UPDATE games SET date = ?, opponent = ?, tournament = ?, venue = ?, result = ? WHERE id = ?',
          ).bind(pick('date'), pick('opponent'), pick('tournament'), pick('venue'), pick('result'), gameId).run();
          replaced = true;
        }
        // REPLACEMENT semantics via the shared write path: delete existing
        // lines, then insert the new set.
        ({ newPlayers } = await writeGameLines(db, gameId, batting, pitching));
      } catch (err) {
        return json({ error: 'Failed to save box score', message: err instanceof Error ? err.message : String(err) }, 500);
      }
      return json({ ok: true, game_id: gameId, replaced, new_players: newPlayers });
    }

    // Per-game line management: GET is public (same data as /api/baseball/stats);
    // PUT and DELETE are password-gated like the other write endpoints.
    const gameRoute = url.pathname.match(/^\/api\/baseball\/games\/(\d+)(\/lines)?$/);
    if (gameRoute) {
      const gameId = Number(gameRoute[1]);
      const isLines = gameRoute[2] === '/lines';
      if (!env.BASEBALL_STATS) return json({ error: 'stats database not configured' }, 503);
      const db = env.BASEBALL_STATS;

      if (request.method === 'GET' && !isLines) {
        try {
          const game = await db.prepare('SELECT id, date, opponent, tournament, venue, result FROM games WHERE id = ?')
            .bind(gameId).first();
          if (!game) return json({ error: 'Game not found' }, 404);
          const batCols = BAT_STAT_FIELDS.map(quoteIdent).join(', ');
          const pitchCols = PITCH_STAT_FIELDS.map(quoteIdent).join(', ');
          const [battingLines, pitchingLines] = await Promise.all([
            db.prepare(
              `SELECT bl.player_id, p.name AS player, p.jersey_number AS jersey, p.pos AS pos, ${batCols} `
              + 'FROM batting_lines bl JOIN players p ON p.id = bl.player_id WHERE bl.game_id = ? ORDER BY p.name',
            ).bind(gameId).all(),
            db.prepare(
              `SELECT pl.player_id, p.name AS player, p.jersey_number AS jersey, p.pos AS pos, pl.ip, ${pitchCols} `
              + 'FROM pitching_lines pl JOIN players p ON p.id = pl.player_id WHERE pl.game_id = ? ORDER BY p.name',
            ).bind(gameId).all(),
          ]);
          return json({
            game: {
              id: game.id, date: game.date, opponent: game.opponent,
              tournament: game.tournament, venue: game.venue, result: game.result,
            },
            batting: (battingLines.results ?? []).map(l => ({ ...l })),
            pitching: (pitchingLines.results ?? []).map(l => ({ ...l })),
          });
        } catch (err) {
          return json({ error: 'Failed to read game', message: err instanceof Error ? err.message : String(err) }, 500);
        }
      }

      if (request.method === 'PUT' && isLines) {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON' }, 400);
        }
        const auth = passwordGate(request, env, body.password);
        if (auth) return auth;
        const input = body.game && typeof body.game === 'object' ? body.game : null;
        const batting = Array.isArray(body.batting) ? body.batting : [];
        const pitching = Array.isArray(body.pitching) ? body.pitching : [];
        try {
          const existing = await db.prepare('SELECT id, date, opponent, tournament, venue, result FROM games WHERE id = ?')
            .bind(gameId).first();
          if (!existing) return json({ error: 'Game not found' }, 404);
          if (input) {
            await db.prepare(
              'UPDATE games SET date = ?, opponent = ?, tournament = ?, venue = ?, result = ? WHERE id = ?',
            ).bind(
              input.date ?? existing.date, input.opponent ?? existing.opponent,
              input.tournament ?? existing.tournament, input.venue ?? existing.venue,
              input.result ?? existing.result, gameId,
            ).run();
          }
          const { newPlayers } = await writeGameLines(db, gameId, batting, pitching);
          return json({ ok: true, game_id: gameId, replaced: true, new_players: newPlayers });
        } catch (err) {
          return json({ error: 'Failed to save lines', message: err instanceof Error ? err.message : String(err) }, 500);
        }
      }

      if (request.method === 'DELETE' && !isLines) {
        let body = {};
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON' }, 400);
        }
        const auth = passwordGate(request, env, body.password);
        if (auth) return auth;
        try {
          await db.batch([
            db.prepare('DELETE FROM batting_lines WHERE game_id = ?').bind(gameId),
            db.prepare('DELETE FROM pitching_lines WHERE game_id = ?').bind(gameId),
          ]);
          const deleted = await db.prepare('DELETE FROM games WHERE id = ?').bind(gameId).run();
          if ((deleted.meta.changes ?? 0) === 0) return json({ error: 'Game not found' }, 404);
          return json({ ok: true, deleted_game_id: gameId });
        } catch (err) {
          return json({ error: 'Failed to delete game', message: err instanceof Error ? err.message : String(err) }, 500);
        }
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    if (url.pathname === '/api/baseball/stats') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!env.BASEBALL_STATS) return json({ error: 'stats database not configured' }, 503);
      const db = env.BASEBALL_STATS;
      let players, games, battingLines, pitchingLines;
      try {
        [players, games, battingLines, pitchingLines] = await Promise.all([
          db.prepare('SELECT id, name, pos, grad_year, jersey_number FROM players ORDER BY name').all(),
          db.prepare('SELECT id, date, opponent, tournament, venue, result FROM games ORDER BY date').all(),
          db.prepare('SELECT * FROM batting_lines').all(),
          db.prepare('SELECT * FROM pitching_lines').all(),
        ]);
      } catch (err) {
        return json({ error: 'Failed to read stats', message: err instanceof Error ? err.message : String(err) }, 500);
      }
      const playerName = new Map((players.results ?? []).map(p => [p.id, p.name]));
      const batAgg = new Map();
      for (const line of battingLines.results ?? []) {
        let agg = batAgg.get(line.player_id);
        if (!agg) {
          agg = { gp: 0 };
          for (const f of BAT_STAT_FIELDS) agg[f] = 0;
          batAgg.set(line.player_id, agg);
        }
        agg.gp += 1;
        for (const f of BAT_STAT_FIELDS) agg[f] += Number(line[f]) || 0;
      }
      const batting = [...batAgg.entries()].map(([playerId, agg]) => {
        const obpDenom = agg.ab + agg.bb + agg.hbp + agg.sf;
        const avg = agg.ab > 0 ? round3(agg.h / agg.ab) : null;
        const obp = obpDenom > 0 ? round3((agg.h + agg.bb + agg.hbp) / obpDenom) : null;
        const slg = agg.ab > 0 ? round3((agg.h + agg['2b'] + 2 * agg['3b'] + 3 * agg.hr) / agg.ab) : null;
        return {
          player_id: playerId, name: playerName.get(playerId) ?? null, gp: agg.gp,
          ab: agg.ab, r: agg.r, h: agg.h, '1b': agg['1b'], '2b': agg['2b'], '3b': agg['3b'], hr: agg.hr,
          rbi: agg.rbi, bb: agg.bb, k: agg.k, sb: agg.sb, cs: agg.cs, hbp: agg.hbp,
          sf: agg.sf, sac: agg.sac, e: agg.e, avg, obp, slg,
          ops: (obp === null || slg === null) ? null : round3(obp + slg),
        };
      });
      const pitchAgg = new Map();
      for (const line of pitchingLines.results ?? []) {
        let agg = pitchAgg.get(line.player_id);
        if (!agg) {
          agg = { gp: 0, thirds: 0 };
          for (const f of PITCH_STAT_FIELDS) agg[f] = 0;
          pitchAgg.set(line.player_id, agg);
        }
        agg.gp += 1;
        agg.thirds += Math.round(ipToTrue(line.ip) * 3);
        for (const f of PITCH_STAT_FIELDS) agg[f] += Number(line[f]) || 0;
      }
      const pitching = [...pitchAgg.entries()].map(([playerId, agg]) => {
        const ipTrue = agg.thirds / 3;
        return {
          player_id: playerId, name: playerName.get(playerId) ?? null, gp: agg.gp,
          ip: trueToIpDecimal(ipTrue),
          h: agg.h, r: agg.r, er: agg.er, bb: agg.bb, k: agg.k, hr: agg.hr,
          hbp: agg.hbp, wp: agg.wp, bf: agg.bf, w: agg.w, l: agg.l, sv: agg.sv,
          pitches: agg.pitches, strikes: agg.strikes,
          era: ipTrue > 0 ? round3(agg.er * 9 / ipTrue) : null,
          whip: ipTrue > 0 ? round3((agg.bb + agg.h) / ipTrue) : null,
        };
      });
      return json({
        players: (players.results ?? []).map(p => ({
          id: p.id, name: p.name, pos: p.pos, grad_year: p.grad_year,
          jersey_number: p.jersey_number ?? null,
        })),
        games: (games.results ?? []).map(g => ({
          id: g.id, date: g.date, opponent: g.opponent, tournament: g.tournament, venue: g.venue, result: g.result,
        })),
        batting, pitching,
      });
    }

    // Live bracket snapshot for 4:13 Baseball, polled from Perfect Game by
    // the Worker cron (see docs/baseball-bracket-poller.md). Last-good
    // semantics: this returns the most recent successful poll, so a Perfect
    // Game blip never blanks the page. 404 when nothing is stored yet — the
    // site falls back to the build-time bracket.json in that case.
    if (url.pathname === '/api/baseball/bracket') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      const tournaments = Array.isArray(baseballSchedule?.tournaments) ? baseballSchedule.tournaments : [];
      const tournament = pickWeekendTournament(tournaments, new Date());
      if (!tournament?.event_id) return json({ error: 'No tournament this weekend' }, 404);
      const key = `${BRACKET_KV_PREFIX}${tournament.event_id}`;
      let live = null;
      try {
        live = await env.SCORES.get(key, 'json');
      } catch {
        return json({ error: 'Bracket snapshot temporarily unavailable' }, 503);
      }
      if (!live) return json({ error: 'Bracket not posted yet', event_id: String(tournament.event_id) }, 404);
      return json({ ...live, updated_at: live.scraped_at ?? null, source: 'Perfect Game' });
    }

    // The hostname rewrite above mutates `url`, so the asset lookup must use
    // the rewritten URL, not the original request (otherwise the baseball
    // host would serve the football homepage).
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },

  async scheduled(controller, env) {
    if (controller.cron === BRACKET_POLL_CRON) {
      await pollBaseballBracket(env, controller.scheduledTime);
      return;
    }
    const game = activeGame(schedule, new Date(controller.scheduledTime));
    if (!game) return;
    const slug = gameSlug(game);
    const previous = await readScore(env, slug);
    if (previous?.status === 'final' || previous?.manualUntil > Date.now()) return;
    // A failed attempt keeps the previous (last good) value in KV, records the
    // failure for watchers, and rethrows so the invocation still shows as
    // failed in the Cloudflare dashboard. Nothing fails silently.
    try {
      const score = await fetchGameScore(game, publication.schoolName, previous);
      await env.SCORES.put(keyFor(slug), JSON.stringify(score));
      await recordIngestAttempt(env, slug, true, score.updatedAt);
    } catch (err) {
      await recordIngestAttempt(env, slug, false, err instanceof Error ? err.message : err);
      throw err;
    }
  },
};

export default worker;
