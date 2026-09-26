import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, extractGameRow, parseScore } from './score.mjs';
import worker from './worker.mjs';

const game = { date: '2026-09-04', opponent: 'Oak Ridge', home: true, kickoff: '7:00 PM' };
const payload = (status = 'Final', score = 45, opponentScore = 20) => ({
  d: JSON.stringify({ success: true, data: JSON.stringify([{ school: 'Klein Cain', opponent: 'Oak Ridge', status, score, opponentScore }]) }),
});

void test('Central game windows include after midnight and handle November standard time', () => {
  assert.equal(activeGame([game], new Date('2026-09-05T05:30:00Z')), game);
  assert.equal(activeGame([game], new Date('2026-09-05T08:00:00Z')), null);
  assert.equal(activeGame([game], new Date('2026-09-04T20:00:00Z')), null);
  const november = { ...game, date: '2026-11-06' };
  assert.equal(activeGame([november], new Date('2026-11-07T00:30:00Z')), november);
});

void test('home and away scores follow venue, including road games', () => {
  const home = parseScore(payload(), game, 'Klein Cain');
  const away = parseScore(payload(), { ...game, home: false }, 'Klein Cain');
  assert.equal(home.homeScore, 45);
  assert.equal(away.homeScore, 20);
  assert.equal(away.awayScore, 45);
});

void test('extractGameRow finds one game in a large payload without parsing every row', () => {
  const filler = Array.from({ length: 2000 }, (_, index) => ({
    gameId: index,
    school: `School ${index}`,
    opponent: `Opponent ${index}`,
    status: 'Final',
    score: 7,
    opponentScore: 14,
    render: '<div class="c-game-score" data-game-id="' + index + '"><span>{}</span></div>',
  }));
  const target = { gameId: 156239, school: 'Klein Cain', opponent: 'Magnolia West', status: '3rd Quarter', score: 48, opponentScore: 0, render: '<div>{}</div>' };
  filler.splice(1000, 0, target);
  const data = JSON.stringify(filler);
  assert.ok(data.length > 300_000, 'fixture should approximate a busy Friday-night feed');
  const matches = extractGameRow(data, 'Klein Cain', 'Magnolia West');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, '3rd Quarter');
  assert.equal(matches[0].score, 48);
  const parsed = parseScore({ d: { success: true, data } }, { date: '2026-09-25', opponent: 'Magnolia West', home: false, kickoff: '7:00 PM' }, 'Klein Cain');
  assert.equal(parsed.awayScore, 48);
  assert.equal(parsed.homeScore, 0);
});

void test('bad data cannot become a zero score or match a different opponent', () => {
  assert.throws(() => parseScore(payload('Final', ''), game, 'Klein Cain'));
  assert.throws(() => parseScore(payload('Final', null), game, 'Klein Cain'));
  assert.throws(() => parseScore(payload('Final', -1), game, 'Klein Cain'));
  assert.throws(() => parseScore(payload('Mystery'), game, 'Klein Cain'));
  assert.throws(() => parseScore(payload(), { ...game, opponent: 'Klein Oak' }, 'Klein Cain'));
});

void test('final cannot regress and repeated reads do not increment a record', () => {
  const previous = { ...parseScore(payload(), game, 'Klein Cain'), homeRecord: '2–0' };
  assert.equal(parseScore(payload('Q4'), game, 'Klein Cain', previous), previous);
  assert.equal(parseScore(payload(), game, 'Klein Cain', previous).homeRecord, '2–0');
});

void test('root redirects to Cain; unknown schools fail closed', async () => {
  const redirect = await worker.fetch(new Request('https://gameday.report/games/week-1'), {});
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), 'https://kleincain.gameday.report/games/week-1');
  assert.equal((await worker.fetch(new Request('https://other.gameday.report/'), {})).status, 404);

  let fetchedUrl = null;
  const mockAssets = {
    fetch: async (req) => {
      fetchedUrl = req.url;
      return new Response('icon-bytes', { status: 200 });
    },
  };
  const iconResponse = await worker.fetch(new Request('https://gameday.report/favicon.ico'), { ASSETS: mockAssets });
  assert.equal(iconResponse.status, 200);
  assert.equal(fetchedUrl, 'https://kleincain.gameday.report/favicon.ico');
});

void test('API falls back to the checked-in snapshot during storage failure', async () => {
  const response = await worker.fetch(new Request(`https://kleincain.gameday.report/api/score?game=${snapshot.slug}`), {
    SCORES: { get: async () => { throw new Error('Storage offline'); } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).slug, snapshot.slug);
});

void test('manual correction requires authorization and scheduled date', async () => {
  const request = body => new Request('https://kleincain.gameday.report/api/score/override', {
    method: 'POST', headers: { authorization: 'Bearer test-token' }, body: JSON.stringify(body),
  });
  assert.equal((await worker.fetch(request({}), {})).status, 401);
  assert.equal((await worker.fetch(request({ date: '2099-01-01', status: 'final', homeScore: 45, awayScore: 20 }), {
    SCORE_ADMIN_TOKEN: 'test-token',
  })).status, 400);
});

void test('cron skips off days and already-final games without fetching the source', async () => {
  await worker.scheduled({ scheduledTime: Date.parse('2026-09-10T23:00:00Z') }, {});
  await worker.scheduled({ scheduledTime: Date.parse('2026-09-05T01:00:00Z') }, {
    SCORES: { get: async () => ({ status: 'final' }) },
  });
});

void test('cron writes KV after parsing a large DCTF payload', async () => {
  const filler = Array.from({ length: 2000 }, (_, index) => ({
    gameId: index,
    school: `School ${index}`,
    opponent: `Opponent ${index}`,
    status: 'Final',
    score: 7,
    opponentScore: 14,
    render: '<div class="c-game-score" data-game-id="' + index + '"><span>{}</span></div>',
  }));
  filler.splice(1000, 0, {
    gameId: 156239,
    school: 'Klein Cain',
    opponent: 'Magnolia West',
    status: '3rd Quarter',
    score: 48,
    opponentScore: 0,
    render: '<div>{}</div>',
  });
  const payload = {
    d: JSON.stringify({
      success: true,
      data: JSON.stringify(filler),
    }),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(payload), { status: 200 });
  let saved = null;
  try {
    await worker.scheduled({ scheduledTime: Date.parse('2026-09-26T01:50:00Z') }, {
      SCORES: {
        get: async () => ({ slug: '2026-09-25-magnolia-west', homeRecord: '2–2', awayRecord: '3–0' }),
        put: async (_key, value) => { saved = JSON.parse(value); },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(saved?.awayScore, 48);
  assert.equal(saved?.homeScore, 0);
  assert.equal(saved?.statusLabel, '3rd Quarter');
});

test('the retired /team address redirects to the program page', async () => {
  const response = await worker.fetch(new Request('https://kleincain.gameday.report/team'), {
    SCORES: { get: async () => null, put: async () => {} },
    ASSETS: { fetch: async () => new Response('asset') },
  });
  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get('location')).pathname, '/');
});
