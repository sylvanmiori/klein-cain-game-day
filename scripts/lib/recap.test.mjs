import assert from 'node:assert/strict';
import test from 'node:test';
import { composeRecap, recordThrough } from './recap.mjs';

const school = 'Klein Cain';
const desk = 'Cain Game Day desk';
const at = new Date('2026-09-18T23:30:00-05:00');

const edition = (over) => ({
  date: '2026-09-18',
  venue: 'Klein Memorial Stadium',
  home: { name: 'Klein Cain', mascot: 'Hurricanes', record: '2–0', rank: null },
  away: { name: 'Tomball', mascot: 'Cougars', record: '1–0', rank: null },
  finalScore: null,
  rating: null,
  massey: null,
  prediction: null,
  ...over,
});

const played = [
  edition({ date: '2026-08-27', home: { name: 'Humble' }, away: { name: 'Klein Cain' }, finalScore: { home: 41, away: 42 } }),
  edition({ date: '2026-09-04', finalScore: { home: 45, away: 20 }, away: { name: 'Oak Ridge' } }),
];

test('no captured score means no recap', () => {
  assert.equal(composeRecap({ edition: edition({}), editions: [], schoolName: school, desk }), null);
});

test('a home win reads as a win with the right margin', () => {
  const game = edition({ finalScore: { home: 31, away: 17 } });
  const recap = composeRecap({ edition: game, editions: [...played, game], schoolName: school, desk, now: at });
  assert.equal(recap.headline, 'Klein Cain beats Tomball, 31–17');
  assert.match(recap.body, /beat Tomball 31–17 at Klein Memorial Stadium on Sept\. 18, a 14-point win/);
  assert.equal(recap.homeScore, 31);
  assert.equal(recap.awayScore, 17);
});

test('a loss is never dressed up as anything else', () => {
  const game = edition({ finalScore: { home: 14, away: 28 } });
  const recap = composeRecap({ edition: game, editions: [game], schoolName: school, desk, now: at });
  assert.equal(recap.headline, 'Tomball beats Klein Cain, 28–14');
  assert.match(recap.body, /lost to Tomball 14–28/);
  assert.match(recap.body, /a 14-point loss/);
});

test('the record counts only games with a captured score', () => {
  assert.equal(recordThrough(played, school, '2026-09-04'), '2–0');
  assert.equal(recordThrough(played, school, '2026-08-27'), '1–0');
  const withLoss = [...played, edition({ finalScore: { home: 10, away: 20 } })];
  assert.equal(recordThrough(withLoss, school, '2026-09-18'), '2–1');
});

test('the recap says whether the published pick was right', () => {
  const game = edition({
    finalScore: { home: 31, away: 17 },
    prediction: { margin: -3, source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://x', asOf: '' },
  });
  const recap = composeRecap({ edition: game, editions: [game], schoolName: school, desk, now: at });
  assert.match(recap.body, /had Tomball by 3; Klein Cain won by 14\./);
});

test('a correct pick is reported as correct', () => {
  const game = edition({
    finalScore: { home: 31, away: 17 },
    prediction: { margin: 10, source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://x', asOf: '' },
  });
  const recap = composeRecap({ edition: game, editions: [game], schoolName: school, desk, now: at });
  assert.match(recap.body, /had Klein Cain by 10; the margin was 14\./);
});

test('our own rating outranks the published pick in the recap', () => {
  const game = edition({
    finalScore: { home: 31, away: 17 },
    rating: { margin: 10, source: 'Cain Game Day', sourceUrl: 'https://x', asOf: '', method: 'x', home: 1, away: 1 },
    prediction: { margin: -3, source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://x', asOf: '' },
  });
  const recap = composeRecap({ edition: game, editions: [game], schoolName: school, desk, now: at });
  assert.match(recap.body, /Cain Game Day had Klein Cain by 10/);
});

test('no player claims are ever produced', () => {
  const game = edition({ finalScore: { home: 31, away: 17 } });
  const recap = composeRecap({ edition: game, editions: [game], schoolName: school, desk, now: at });
  assert.equal(recap.leaders, null, 'no verified postgame player statistics exist');
  assert.deepEqual(recap.notes, []);
});
