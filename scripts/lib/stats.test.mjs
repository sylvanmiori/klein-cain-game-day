import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatLeaders } from './sources.mjs';

const page = (data) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;

const leader = (over = {}) => ({
  athleteFirstName: 'Cooper',
  athleteLastName: 'Karns',
  athletePositions: 'WR',
  currentRank: 1,
  stat: { header: 'Y/G', displayName: 'Receiving Yards Per Game', value: '73.5' },
  ...over,
});

const wrap = (leaders, updated = '2026-09-05T11:10:51') =>
  page({ props: { pageProps: { playerStatLeadersData: { leaders, lastUpdated: { timeStamp: updated } } } } });

test('reads a leader into a flat, attributed row', () => {
  const { leaders, updated, source } = parseStatLeaders(wrap([leader()]));
  assert.equal(source, 'MaxPreps');
  assert.equal(updated, '2026-09-05T11:10:51');
  assert.deepEqual(leaders, [{
    category: 'Receiving Yards Per Game',
    header: 'Y/G',
    name: 'Cooper Karns',
    position: 'WR',
    value: '73.5',
    rank: 1,
  }]);
});

test('a zero value is kept, because zero is a real statistic', () => {
  const { leaders } = parseStatLeaders(wrap([leader({ stat: { header: 'Int', displayName: 'Interceptions', value: 0 } })]));
  assert.equal(leaders[0].value, '0');
});

test('rows missing a name, category or value are dropped rather than guessed', () => {
  const { leaders } = parseStatLeaders(wrap([
    leader(),
    leader({ athleteFirstName: '', athleteLastName: '' }),
    leader({ stat: { header: 'X', displayName: '', value: '1' } }),
    leader({ stat: { header: 'X', displayName: 'Sacks', value: null } }),
  ]));
  assert.equal(leaders.length, 1);
});

test('a page without the data block fails instead of publishing nothing quietly', () => {
  assert.throws(() => parseStatLeaders('<html><body>no data</body></html>'), /did not contain/);
});

test('an empty leader list is an error, not an empty section', () => {
  assert.throws(() => parseStatLeaders(wrap([])), /listed no leaders/);
  assert.throws(() => parseStatLeaders(wrap([leader({ athleteFirstName: '', athleteLastName: '' })])), /No usable/);
});

test('missing freshness information is an error', () => {
  assert.throws(() => parseStatLeaders(wrap([leader()], null)), /last updated/);
});

test('malformed JSON is reported clearly', () => {
  assert.throws(
    () => parseStatLeaders('<script id="__NEXT_DATA__" type="application/json">{oops</script>'),
    /not valid JSON/,
  );
});
