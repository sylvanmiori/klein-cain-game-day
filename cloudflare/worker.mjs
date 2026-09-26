import publication from '../config/publication.json' with { type: 'json' };
import schedule from '../config/season-2026.json' with { type: 'json' };
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, gameSlug, fetchGameScore } from './score.mjs';

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
 * Password gate for box-score uploads. Returns a failure Response, or null
 * when the supplied password matches env.BOXSCORE_PASSWORD. The password is
 * never logged and never echoed back in responses.
 */
function boxscoreAuth(env, supplied) {
  if (!env.BOXSCORE_PASSWORD) return json({ error: 'uploads not configured' }, 503);
  if (!timingSafeEqual(supplied ?? '', env.BOXSCORE_PASSWORD)) return json({ error: 'Unauthorized' }, 401);
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
    const { results } = await env.BASEBALL_STATS.prepare('SELECT name FROM players ORDER BY name').all();
    return results.length ? results.map(r => r.name) : BASEBALL_SEED_NAMES;
  } catch {
    return BASEBALL_SEED_NAMES;
  }
}

function boxscorePrompt(rosterNames) {
  return 'You are a baseball box-score transcriber. Read the attached box-score screenshot and return ONLY a single JSON object, no markdown fences and no commentary, with this exact shape:\n'
    + '{"batting":[{"player":"Name","ab":0,"r":0,"h":0,"2b":0,"3b":0,"hr":0,"rbi":0,"bb":0,"k":0,"sb":0,"cs":0,"hbp":0,"sf":0,"sac":0}],'
    + '"pitching":[{"player":"Name","ip":0,"h":0,"r":0,"er":0,"bb":0,"k":0,"hr":0,"hbp":0,"wp":0,"bf":0,"w":0,"l":0,"sv":0}],'
    + '"game":{"date":null,"opponent":null,"tournament":null,"venue":null,"result":null}}\n'
    + 'Rules: every stat value is an integer except ip, which is baseball-decimal innings pitched (e.g. 5.2 means 5 and 2/3 innings). '
    + 'Include one batting row per player who batted and one pitching row per pitcher who threw. Use null for any game field you cannot read. '
    + 'Match player names loosely to this roster (ignore case and punctuation):\n'
    + rosterNames.join(', ');
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

const BAT_STAT_FIELDS = ['ab', 'r', 'h', '2b', '3b', 'hr', 'rbi', 'bb', 'k', 'sb', 'cs', 'hbp', 'sf', 'sac'];
const PITCH_STAT_FIELDS = ['h', 'r', 'er', 'bb', 'k', 'hr', 'hbp', 'wp', 'bf', 'w', 'l', 'sv'];
const round3 = v => Math.round(v * 1000) / 1000;

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
      && url.pathname !== '/baseball' && !url.pathname.startsWith('/baseball/')) {
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
      const auth = boxscoreAuth(env, form.get('password'));
      if (auth) return auth;
      const image = form.get('image');
      if (!image || typeof image.arrayBuffer !== 'function') {
        return json({ error: 'Provide an image file.' }, 400);
      }
      const bytes = await image.arrayBuffer();
      if (bytes.byteLength === 0) return json({ error: 'Image file is empty.' }, 400);
      if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: 'Image too large (10 MB max).' }, 413);
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
      const contentType = image.type || 'image/png';
      let parsed;
      try {
        const aiOut = await env.AI.run(BOXSCORE_VISION_MODEL, {
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: boxscorePrompt(rosterNames) },
              { type: 'image_url', image_url: { url: `data:${contentType};base64,${arrayBufferToBase64(bytes)}` } },
            ],
          }],
        });
        const text = typeof aiOut === 'string' ? aiOut : aiOut?.response;
        parsed = extractJsonObject(text);
      } catch (err) {
        return json({ error: 'Box-score extraction failed', message: err instanceof Error ? err.message : String(err) }, 502);
      }
      const batting = (Array.isArray(parsed.batting) ? parsed.batting : []).map(line => {
        const row = { player: String(line.player ?? '').trim() };
        for (const f of BAT_STAT_FIELDS) row[f] = toInt(line[f]);
        return row;
      });
      const pitching = (Array.isArray(parsed.pitching) ? parsed.pitching : []).map(line => {
        const row = { player: String(line.player ?? '').trim(), ip: Number(line.ip) || 0 };
        for (const f of PITCH_STAT_FIELDS) row[f] = toInt(line[f]);
        return row;
      });
      const gameFields = ['date', 'opponent', 'tournament', 'venue', 'result'];
      const modelGame = parsed.game && typeof parsed.game === 'object' ? parsed.game : {};
      const game = { id: gameId };
      for (const f of gameFields) {
        const formKey = f === 'date' ? 'game_date' : f;
        const formVal = String(form.get(formKey) ?? '').trim();
        const modelVal = modelGame[f] === undefined || modelGame[f] === null ? null : String(modelGame[f]).trim() || null;
        game[f] = formVal !== '' ? formVal : modelVal;
      }
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
      return json({ game, batting, pitching, already_exists: alreadyExists });
    }

    if (url.pathname === '/api/baseball/boxscore/confirm') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }
      const auth = boxscoreAuth(env, body.password);
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
      const newPlayers = [];
      try {
        if (gameId === null) {
          const inserted = await db.prepare(
            'INSERT INTO games (date, opponent, tournament, venue, result) VALUES (?, ?, ?, ?, ?)',
          ).bind(input.date ?? null, input.opponent ?? null, input.tournament ?? null, input.venue ?? null, input.result ?? null).run();
          gameId = Number(inserted.meta.last_row_id);
        } else {
          const existing = await db.prepare('SELECT id FROM games WHERE id = ?').bind(gameId).first();
          if (!existing) return json({ error: 'Game not found' }, 404);
          replaced = true;
        }
        // Player name -> player_id, case-insensitive. Unknown names grow the
        // roster automatically so re-uploads stay idempotent.
        const { results: players } = await db.prepare('SELECT id, name FROM players').all();
        const byName = new Map(players.map(p => [String(p.name).toLowerCase(), p.id]));
        const resolvePlayer = async name => {
          const display = String(name ?? '').trim() || 'Unknown';
          const key = display.toLowerCase();
          if (byName.has(key)) return byName.get(key);
          const inserted = await db.prepare('INSERT INTO players (name, pos, grad_year) VALUES (?, ?, ?)')
            .bind(display, 'UT', null).run();
          const id = Number(inserted.meta.last_row_id);
          byName.set(key, id);
          if (!newPlayers.includes(display)) newPlayers.push(display);
          return id;
        };
        // REPLACEMENT semantics: delete existing lines, then insert the new set.
        const statements = [
          db.prepare('DELETE FROM batting_lines WHERE game_id = ?').bind(gameId),
          db.prepare('DELETE FROM pitching_lines WHERE game_id = ?').bind(gameId),
        ];
        for (const line of batting) {
          const playerId = await resolvePlayer(line.player);
          const values = [gameId, playerId, ...BAT_STAT_FIELDS.map(f => toInt(line[f]))];
          statements.push(db.prepare(
            'INSERT INTO batting_lines (game_id, player_id, ab, r, h, "2b", "3b", hr, rbi, bb, k, sb, cs, hbp, sf, sac) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).bind(...values));
        }
        for (const line of pitching) {
          const playerId = await resolvePlayer(line.player);
          const values = [gameId, playerId, Number(line.ip) || 0, ...PITCH_STAT_FIELDS.map(f => toInt(line[f]))];
          statements.push(db.prepare(
            'INSERT INTO pitching_lines (game_id, player_id, ip, h, r, er, bb, k, hr, hbp, wp, bf, w, l, sv) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).bind(...values));
        }
        await db.batch(statements);
      } catch (err) {
        return json({ error: 'Failed to save box score', message: err instanceof Error ? err.message : String(err) }, 500);
      }
      return json({ ok: true, game_id: gameId, replaced, new_players: newPlayers });
    }

    if (url.pathname === '/api/baseball/stats') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      if (!env.BASEBALL_STATS) return json({ error: 'stats database not configured' }, 503);
      const db = env.BASEBALL_STATS;
      let players, games, battingLines, pitchingLines;
      try {
        [players, games, battingLines, pitchingLines] = await Promise.all([
          db.prepare('SELECT id, name, pos, grad_year FROM players ORDER BY name').all(),
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
          ab: agg.ab, r: agg.r, h: agg.h, '2b': agg['2b'], '3b': agg['3b'], hr: agg.hr,
          rbi: agg.rbi, bb: agg.bb, k: agg.k, sb: agg.sb, cs: agg.cs, hbp: agg.hbp,
          sf: agg.sf, sac: agg.sac, avg, obp, slg,
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
          era: ipTrue > 0 ? round3(agg.er * 9 / ipTrue) : null,
          whip: ipTrue > 0 ? round3((agg.bb + agg.h) / ipTrue) : null,
        };
      });
      return json({
        players: (players.results ?? []).map(p => ({ id: p.id, name: p.name, pos: p.pos, grad_year: p.grad_year })),
        games: (games.results ?? []).map(g => ({
          id: g.id, date: g.date, opponent: g.opponent, tournament: g.tournament, venue: g.venue, result: g.result,
        })),
        batting, pitching,
      });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env) {
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
