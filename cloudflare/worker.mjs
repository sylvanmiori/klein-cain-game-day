import publication from '../config/publication.json' with { type: 'json' };
import schedule from '../config/season-2026.json' with { type: 'json' };
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, gameSlug, fetchGameScore } from './score.mjs';

const keyFor = slug => `${publication.schoolId}:${slug}`;
const metaKeyFor = slug => `${publication.schoolId}:${slug}:ingest`;
/** A live score with no successful ingest for this long is reported as stale. */
const STALE_AFTER_MS = 10 * 60 * 1000;
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
    if (url.hostname !== publication.schoolHostname && !url.hostname.endsWith('.workers.dev')
      && !['localhost', '127.0.0.1'].includes(url.hostname)) return new Response('School not found', { status: 404 });

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
