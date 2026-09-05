import test from 'node:test';
import assert from 'node:assert/strict';
import { activeGame, parseScore, gameSlug } from './score.mjs';
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
  assert.equal(redirect.headers.get('location'), 'https://kleincain.gameday.report/games/week-1');
  assert.equal((await worker.fetch(new Request('https://other.gameday.report/'), {})).status, 404);
});

void test('API falls back to checked-in final during storage failure', async () => {
  const response = await worker.fetch(new Request(`https://kleincain.gameday.report/api/score?game=${gameSlug(game)}`), {
    SCORES: { get: async () => { throw new Error('Storage offline'); } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).homeScore, 45);
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
