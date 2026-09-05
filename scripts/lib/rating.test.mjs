import assert from 'node:assert/strict';
import test from 'node:test';
import { MARGIN_CAP, buildGames, formatRecord, homeAdvantage, predict, rate, teamRecords } from './rating.mjs';

/** The feed reports one game twice, once per school, with different game ids. */
const bothViews = (date, home, away, homeScore, awayScore) => [
  { gameDate: date, status: 'Final', school: home, opponent: away, score: homeScore, opponentScore: awayScore, location: 'Home', gameId: 1 },
  { gameDate: date, status: 'Final', school: away, opponent: home, score: awayScore, opponentScore: homeScore, location: 'Away', gameId: 2 },
];

test('one game counts once even though the feed reports it twice with different ids', () => {
  const games = buildGames(bothViews('2026-08-28', 'Klein Cain', 'Humble', 42, 41));
  assert.equal(games.length, 1);
  assert.deepEqual(
    { home: games[0].home, away: games[0].away, homeScore: games[0].homeScore, awayScore: games[0].awayScore },
    { home: 'Klein Cain', away: 'Humble', homeScore: 42, awayScore: 41 },
  );
  const model = rate(games);
  assert.equal(model.games.get('Klein Cain'), 1, 'a single game must not be double counted');
});

test('unplayed and malformed rows are ignored', () => {
  const rows = [
    { gameDate: '2026-09-18', status: 'Upcoming', school: 'A', opponent: 'B', score: 0, opponentScore: 0, location: 'Home' },
    { gameDate: '2026-09-18', status: 'Final', school: 'C', opponent: 'D', score: 'x', opponentScore: 3, location: 'Home' },
    { gameDate: '2026-09-18', status: 'Final', school: 'E', opponent: '', score: 7, opponentScore: 3, location: 'Home' },
  ];
  assert.deepEqual(buildGames(rows), []);
});

test('running up the score cannot buy more than the cap', () => {
  const blowout = buildGames(bothViews('2026-08-28', 'A', 'B', 90, 0));
  const capped = buildGames(bothViews('2026-08-28', 'A', 'B', MARGIN_CAP, 0));
  const spread = (games) => {
    const model = rate(games);
    return model.ratings.get('A') - model.ratings.get('B');
  };
  assert.ok(Math.abs(spread(blowout) - spread(capped)) < 1e-9, 'a 90-point win must rate like a capped win');
});

test('home advantage is measured, not assumed', () => {
  const games = buildGames([
    ...bothViews('2026-08-28', 'A', 'B', 20, 10),
    ...bothViews('2026-09-04', 'B', 'A', 20, 10),
  ]);
  // Two mirrored results: the teams are equal and all the margin is home field.
  assert.equal(homeAdvantage(games), 10);
  const model = rate(games);
  assert.ok(Math.abs(model.ratings.get('A') - model.ratings.get('B')) < 1e-9);
});

/** Neutral sites, so the home-field term cannot absorb the signal. */
const neutral = (date, a, b, aScore, bScore) => [
  { gameDate: date, status: 'Final', school: a, opponent: b, score: aScore, opponentScore: bScore, location: 'Neutral', gameId: 1 },
  { gameDate: date, status: 'Final', school: b, opponent: a, score: bScore, opponentScore: aScore, location: 'Neutral', gameId: 2 },
];

test('a stronger team rates above a weaker one through a shared opponent', () => {
  const games = buildGames([
    ...neutral('2026-08-28', 'Strong', 'Middle', 28, 0),
    ...neutral('2026-09-04', 'Middle', 'Weak', 21, 0),
    ...neutral('2026-09-11', 'Strong', 'Weak', 28, 0),
  ]);
  assert.equal(homeAdvantage(games), 0);
  const { ratings } = rate(games);
  assert.ok(ratings.get('Strong') > ratings.get('Middle'));
  assert.ok(ratings.get('Middle') > ratings.get('Weak'));
});

test('a team without enough games earns no published rating', () => {
  const rows = [];
  for (let week = 0; week < 6; week += 1) {
    rows.push(...bothViews(`2026-09-${10 + week}`, 'Busy', `Opponent${week}`, 21, 14));
  }
  const model = rate(buildGames(rows));
  assert.ok(model.games.get('Busy') >= 4);
  assert.equal(model.games.get('Opponent0'), 1);
  assert.equal(predict(model, 'Busy', 'Opponent0'), null, 'one game is not enough evidence to rate');
});

test('an unknown team is never predicted', () => {
  const model = rate(buildGames(bothViews('2026-08-28', 'A', 'B', 20, 10)));
  assert.equal(predict(model, 'A', 'Nobody'), null);
});

test('records come from the same completed games as the rating', () => {
  const games = buildGames([
    ...bothViews('2026-08-28', 'A', 'B', 21, 7),
    ...bothViews('2026-09-04', 'B', 'A', 14, 10),
    ...bothViews('2026-09-11', 'A', 'C', 3, 3),
  ]);
  const records = teamRecords(games);
  assert.equal(formatRecord(records.get('A')), '1–1–1');
  assert.equal(formatRecord(records.get('B')), '1–1');
  assert.equal(formatRecord(records.get('C')), '0–0–1');
  assert.equal(formatRecord(records.get('Nobody')), null);
});
