import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../public/live-score.json' with { type: 'json' };
import { activeGame, parseScore, stripHeavyScoreFields, extractSchoolGames, fetchGameScore, MAX_SCORE_PAYLOAD_BYTES } from './score.mjs';
import worker, { scoreIsStale } from './worker.mjs';

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

void test('strip keeps valid JSON when a heavy field sits between normal fields', () => {
  const raw = JSON.stringify([{
    school: 'Klein Cain', render: '<div>x</div>', opponent: 'Oak Ridge',
    status: '3rd Quarter', score: 48, opponentScore: 0, errorList: ['e1'],
    pick: 11,
  }]);
  const stripped = stripHeavyScoreFields(raw);
  const row = JSON.parse(stripped)[0];
  assert.equal(row.school, 'Klein Cain');
  assert.equal(row.opponent, 'Oak Ridge');
  assert.equal(row.pick, 11);
  assert.equal(row.render, undefined);
  assert.equal(row.errorList, undefined);
});

void test('strip handles heavy fields as the only field, last field, and first field', () => {
  assert.deepEqual(JSON.parse(stripHeavyScoreFields('[{"render":"<b>x</b>"}]')), [{}]);
  assert.deepEqual(
    JSON.parse(stripHeavyScoreFields('[{"a":1,"render":"<b>x</b>"}]')),
    [{ a: 1 }],
  );
  assert.deepEqual(
    JSON.parse(stripHeavyScoreFields('[{"render":"<b>x</b>","a":1}]')),
    [{ a: 1 }],
  );
  assert.deepEqual(
    JSON.parse(stripHeavyScoreFields('[{"a":1,"errorList":["e"],"b":2}]')),
    [{ a: 1, b: 2 }],
  );
});

void test('strip never touches heavy-looking text inside ordinary string values', () => {
  const note = 'coach said "render":"keep me" out loud';
  const raw = JSON.stringify([{ school: 'Klein Cain', note, render: '<div>x</div>' }]);
  const row = JSON.parse(stripHeavyScoreFields(raw))[0];
  assert.equal(row.note, note);
  assert.equal(row.render, undefined);
});

void test('extraction tolerates rows with nested objects (shape change)', () => {
  const data = JSON.stringify([
    {
      school: 'Klein Cain', opponent: 'Oak Ridge', status: 'Final', score: 45, opponentScore: 20,
      venue: { name: 'Stadium', city: 'Spring' }, tags: ['district'],
    },
    { school: 'Other', opponent: 'Foe', status: 'Final', score: 1, opponentScore: 2 },
  ]);
  const rows = extractSchoolGames(data, 'Klein Cain');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].venue.name, 'Stadium');
  const parsed = parseScore({ d: JSON.stringify({ success: true, data }) }, game, 'Klein Cain');
  assert.equal(parsed.status, 'final');
  assert.equal(parsed.homeScore, 45);
});

void test('a renamed school key fails closed instead of matching nothing silently', () => {
  const data = JSON.stringify([{
    team: 'Klein Cain', opponent: 'Oak Ridge', status: 'Final', score: 45, opponentScore: 20,
  }]);
  assert.deepEqual(extractSchoolGames(data, 'Klein Cain'), []);
  assert.throws(
    () => parseScore({ d: JSON.stringify({ success: true, data }) }, game, 'Klein Cain'),
    /did not uniquely match/,
  );
});

void test('time-style and bot-style status labels are recognized (regex escape regression)', () => {
  for (const label of ['7:00 PM', '7:00 P.M.', '7:00PM', 'Scheduled']) {
    const parsed = parseScore(payload(label, '', ''), game, 'Klein Cain');
    assert.equal(parsed.status, 'scheduled', label);
  }
  for (const label of ['Bot 7th', 'bot 8']) {
    const parsed = parseScore(payload(label, 10, 7), game, 'Klein Cain');
    assert.equal(parsed.status, 'live', label);
  }
});

void test('malformed envelopes and non-array data throw instead of parsing halfway', () => {
  assert.throws(() => parseScore({ d: 'this is not json' }, game, 'Klein Cain'));
  assert.throws(
    () => parseScore({ d: JSON.stringify({ success: true, data: { school: 'Klein Cain' } }) }, game, 'Klein Cain'),
    /format changed/,
  );
  assert.throws(
    () => parseScore({ d: JSON.stringify({ success: false }) }, game, 'Klein Cain'),
    /unsuccessful/,
  );
  const missingStatus = {
    d: JSON.stringify({ success: true, data: JSON.stringify([{ school: 'Klein Cain', opponent: 'Oak Ridge', score: 45, opponentScore: 20 }]) }),
  };
  assert.throws(() => parseScore(missingStatus, game, 'Klein Cain'), /Unrecognized game status/);
});

void test('oversized source payloads are rejected before parsing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('x'.repeat(MAX_SCORE_PAYLOAD_BYTES + 1), { status: 200 });
  try {
    await assert.rejects(
      fetchGameScore(game, 'Klein Cain'),
      /payload too large/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('scoreIsStale flags only aging live scores', () => {
  const live = { status: 'live', updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() };
  const fresh = { status: 'live', updatedAt: new Date().toISOString() };
  assert.equal(scoreIsStale(live), true);
  assert.equal(scoreIsStale(fresh), false);
  assert.equal(scoreIsStale({ status: 'final', updatedAt: live.updatedAt }), false);
  assert.equal(scoreIsStale({ status: 'scheduled', updatedAt: live.updatedAt }), false);
  assert.equal(scoreIsStale(null), false);
});

void test('/api/score exposes staleness and /api/score/health exposes ingest telemetry', async () => {
  const staleScore = {
    schemaVersion: 1, slug: snapshot.slug, status: 'live', statusLabel: '4th Quarter',
    homeScore: 7, awayScore: 58, homeRecord: '', awayRecord: '',
    updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.texasfootball.com/scores/',
  };
  const meta = {
    slug: snapshot.slug, lastAttempt: new Date().toISOString(),
    lastSuccess: staleScore.updatedAt, lastError: 'Score source HTTP 500', consecutiveFailures: 2,
  };
  const env = {
    SCORES: {
      get: async (key) => (key.endsWith(':ingest') ? meta : staleScore),
      put: async () => {},
    },
  };
  const scoreRes = await worker.fetch(new Request(`https://kleincain.gameday.report/api/score?game=${snapshot.slug}`), env);
  const body = await scoreRes.json();
  assert.equal(body.stale, true);
  assert.equal(body.asOf, staleScore.updatedAt);
  assert.equal(body.awayScore, 58);

  const healthRes = await worker.fetch(new Request(`https://kleincain.gameday.report/api/score/health?game=${snapshot.slug}`), env);
  const health = await healthRes.json();
  assert.equal(health.slug, snapshot.slug);
  assert.equal(health.scoreStatus, 'live');
  assert.equal(health.stale, true);
  assert.equal(health.consecutiveFailures, 2);
  assert.equal(health.lastError, 'Score source HTTP 500');

  const unknown = await worker.fetch(new Request('https://kleincain.gameday.report/api/score/health?game=2099-01-01-nope'), env);
  assert.equal(unknown.status, 404);
});

void test('a failed cron attempt keeps the last good score and records the failure', async () => {
  const puts = {};
  const lastGood = {
    schemaVersion: 1, slug: '2026-09-25-magnolia-west', status: 'live', statusLabel: '3rd Quarter',
    homeScore: 7, awayScore: 35, homeRecord: '', awayRecord: '',
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.texasfootball.com/scores/',
  };
  const env = {
    SCORES: {
      get: async (key) => (key.endsWith(':ingest') ? null : lastGood),
      put: async (key, value) => { puts[key] = value; },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  try {
    // 2026-09-26T01:00:00Z is 8 PM CDT on Sep 25, inside the Magnolia West window.
    await assert.rejects(
      worker.scheduled({ scheduledTime: Date.parse('2026-09-26T01:00:00Z') }, env),
      /network down/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const scoreKeys = Object.keys(puts).filter((k) => !k.endsWith(':ingest'));
  assert.deepEqual(scoreKeys, [], 'the last good score must not be overwritten');
  const ingestKeys = Object.keys(puts).filter((k) => k.endsWith(':ingest'));
  assert.equal(ingestKeys.length, 1);
  const ingest = JSON.parse(puts[ingestKeys[0]]);
  assert.equal(ingest.consecutiveFailures, 1);
  assert.match(ingest.lastError, /network down/);
  assert.ok(ingest.lastAttempt);
});

void test('a successful cron attempt stores the score and resets failure telemetry', async () => {
  const puts = {};
  const livePrevious = {
    schemaVersion: 1, slug: '2026-09-25-magnolia-west', status: 'live', statusLabel: '3rd Quarter',
    homeScore: 7, awayScore: 35, homeRecord: '', awayRecord: '',
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.texasfootball.com/scores/',
  };
  const env = {
    SCORES: {
      get: async (key) => (key.endsWith(':ingest')
        ? { slug: '2026-09-25-magnolia-west', consecutiveFailures: 4, lastError: 'boom' }
        : livePrevious),
      put: async (key, value) => { puts[key] = value; },
    },
  };
  const data = JSON.stringify([{
    school: 'Klein Cain', opponent: 'Magnolia West', status: '4th Quarter',
    score: 58, opponentScore: 7,
  }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ d: JSON.stringify({ success: true, data }) }), { status: 200 });
  try {
    await worker.scheduled({ scheduledTime: Date.parse('2026-09-26T01:00:00Z') }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const scoreKey = Object.keys(puts).find((k) => !k.endsWith(':ingest'));
  assert.ok(scoreKey, 'score should be stored');
  assert.equal(JSON.parse(puts[scoreKey]).awayScore, 58);
  const ingest = JSON.parse(puts[Object.keys(puts).find((k) => k.endsWith(':ingest'))]);
  assert.equal(ingest.consecutiveFailures, 0);
  assert.equal(ingest.lastError, null);
  assert.ok(ingest.lastSuccess);
});

void test('steady-state successes heartbeat instead of writing KV every minute', async () => {
  let puts = 0;
  const livePrevious = {
    schemaVersion: 1, slug: '2026-09-25-magnolia-west', status: 'live', statusLabel: '3rd Quarter',
    homeScore: 7, awayScore: 35, homeRecord: '', awayRecord: '',
    updatedAt: new Date().toISOString(),
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.texasfootball.com/scores/',
  };
  const recentMeta = {
    slug: livePrevious.slug, lastAttempt: new Date().toISOString(),
    lastSuccess: livePrevious.updatedAt, lastError: null, consecutiveFailures: 0,
  };
  const env = {
    SCORES: {
      get: async (key) => (key.endsWith(':ingest') ? recentMeta : livePrevious),
      put: async (key) => { if (key.endsWith(':ingest')) puts += 1; },
    },
  };
  const data = JSON.stringify([{
    school: 'Klein Cain', opponent: 'Magnolia West', status: '4th Quarter',
    score: 58, opponentScore: 7,
  }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ d: JSON.stringify({ success: true, data }) }), { status: 200 });
  try {
    await worker.scheduled({ scheduledTime: Date.parse('2026-09-26T01:00:00Z') }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(puts, 0, 'a healthy steady state should not write ingest KV every minute');
});
