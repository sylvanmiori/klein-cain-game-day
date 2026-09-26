import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, parseScore, stripHeavyScoreFields, extractSchoolGames } from './score.mjs';
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

void test('multi-MB render HTML is stripped so Friday-night payloads still parse', () => {
  const fatRender = '<div class="c-game-score">' + 'x'.repeat(5000) + '</div>';
  const row = {
    school: 'Klein Cain', opponent: 'Oak Ridge', status: '3rd Quarter',
    score: 48, opponentScore: 0, render: fatRender,
    errorList: ['Property not found for Column (schoolTypeSortOrder)'],
  };
  const decoys = Array.from({ length: 200 }, (_, i) => ({
    school: `Other ${i}`, opponent: `Foe ${i}`, status: 'Half Time',
    score: 7, opponentScore: 3, render: fatRender, errorList: [],
  }));
  const payload = {
    d: JSON.stringify({ success: true, data: JSON.stringify([row, ...decoys]) }),
  };
  const parsed = parseScore(payload, game, 'Klein Cain');
  assert.equal(parsed.status, 'live');
  assert.equal(parsed.statusLabel, '3rd Quarter');
  assert.equal(parsed.homeScore, 48);
  assert.equal(parsed.awayScore, 0);
});

void test('live score regressions cannot overwrite a higher verified score', () => {
  const road = { date: '2026-09-25', opponent: 'Magnolia West', home: false, kickoff: '7:00 PM' };
  const previous = parseScore({
    d: JSON.stringify({ success: true, data: JSON.stringify([{
      school: 'Klein Cain', opponent: 'Magnolia West', status: '4th Quarter', score: 58, opponentScore: 7,
    }]) }),
  }, road, 'Klein Cain');
  assert.equal(previous.homeScore, 7);
  assert.equal(previous.awayScore, 58);
  const flickered = parseScore({
    d: JSON.stringify({ success: true, data: JSON.stringify([{
      school: 'Klein Cain', opponent: 'Magnolia West', status: '4th Quarter', score: 58, opponentScore: 0,
    }]) }),
  }, road, 'Klein Cain', previous);
  assert.equal(flickered.homeScore, 7);
  assert.equal(flickered.awayScore, 58);
});


void test('extract-before-parse handles 1000+ row Friday payloads without full-array JSON.parse', () => {
  const target = {
    school: 'Klein Cain', opponent: 'Magnolia West', status: '4th Quarter',
    score: 58, opponentScore: 7, gameId: 1, location: 'Away', isDistrict: true,
  };
  const decoys = Array.from({ length: 1200 }, (_, i) => ({
    school: `Decoy High ${i}`, opponent: `Rival ${i}`, status: '2nd Quarter',
    score: 14, opponentScore: 7, gameId: i + 10, location: 'Home', isDistrict: false,
    pad: 'y'.repeat(80),
  }));
  // Put target near the end so a naive scan still has to skip most rows.
  const data = JSON.stringify([...decoys.slice(0, 1100), target, ...decoys.slice(1100)]);
  assert.ok(data.length > 200_000, `expected multi-hundred-KB payload, got ${data.length}`);
  const originalParse = JSON.parse;
  let fullArrayParses = 0;
  JSON.parse = (text, ...rest) => {
    if (typeof text === 'string' && text.startsWith('[') && text.length > 50_000) fullArrayParses += 1;
    return originalParse(text, ...rest);
  };
  try {
    const road = { date: '2026-09-25', opponent: 'Magnolia West', home: false, kickoff: '7:00 PM' };
    const parsed = parseScore({
      d: JSON.stringify({ success: true, data }),
    }, road, 'Klein Cain');
    assert.equal(parsed.status, 'live');
    assert.equal(parsed.homeScore, 7);
    assert.equal(parsed.awayScore, 58);
    assert.equal(fullArrayParses, 0, 'must not JSON.parse the full games array');
    const only = extractSchoolGames(data, 'Klein Cain');
    assert.equal(only.length, 1);
    assert.equal(only[0].opponent, 'Magnolia West');
  } finally {
    JSON.parse = originalParse;
  }
});

void test('stripHeavyScoreFields is linear and drops render/errorList', () => {
  const fat = 'x'.repeat(20000);
  const raw = JSON.stringify([{
    school: 'Klein Cain', opponent: 'Oak Ridge', status: '3rd Quarter',
    score: 48, opponentScore: 0, render: `<div>${fat}</div>`,
    errorList: ['Property not found for Column (schoolTypeSortOrder)'],
  }]);
  const stripped = stripHeavyScoreFields(raw);
  assert.equal(stripped.includes('"render"'), false);
  assert.equal(stripped.includes('"errorList"'), false);
  const row = JSON.parse(stripped)[0];
  assert.equal(row.score, 48);
  assert.equal(row.render, undefined);
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

test('the retired /team address redirects to the program page', async () => {
  const response = await worker.fetch(new Request('https://kleincain.gameday.report/team'), {
    SCORES: { get: async () => null, put: async () => {} },
    ASSETS: { fetch: async () => new Response('asset') },
  });
  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get('location')).pathname, '/');
});
