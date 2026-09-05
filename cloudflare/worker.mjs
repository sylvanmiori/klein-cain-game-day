import publication from '../config/publication.json' with { type: 'json' };
import schedule from '../config/season-2026.json' with { type: 'json' };
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, gameSlug, fetchGameScore } from './score.mjs';

const keyFor = slug => `${publication.schoolId}:${slug}`;
const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

async function readScore(env, slug) {
  const saved = await env.SCORES.get(keyFor(slug), 'json');
  return saved || (snapshot.slug === slug ? snapshot : null);
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === publication.domain) {
      url.hostname = publication.schoolHostname;
      return Response.redirect(url.toString(), 302);
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
        return score ? json(score) : json({ error: 'Score not available yet' }, 404);
      } catch {
        return snapshot.slug === slug ? json(snapshot) : json({ error: 'Score temporarily unavailable' }, 503);
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
    // Errors leave the previous value intact and appear as failed cron invocations.
    const score = await fetchGameScore(game, publication.schoolName, previous);
    await env.SCORES.put(keyFor(slug), JSON.stringify(score));
  },
};

export default worker;
