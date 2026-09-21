import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDistrictRecords, parseDistrictStandings } from './sources.mjs';

const html = `
<h3>District 15-6A Standings</h3>
<ul>
  <li class=" c-box-team-schedule-hdr"><span>Team</span><span>District Record</span><span>Overall Record</span><span>Next Opponent</span></li>
  <li class=""><span><a>Klein Bearkats</a></span><span>2 - 0</span><span>4 - 0</span><span>Magnolia Bulldogs</span></li>
  <li class="c-box-team-schedule-hdr"><span><a>Klein Cain Hurricanes</a></span><span>1 - 0</span><span>3 - 0</span><span>Magnolia West Mustangs</span></li>
  <li class=""><span><a>Klein Collins Tigers</a></span><span>2 - 0</span><span>3 - 1</span><span>Idle</span></li>
  <li><span>*Record tiebreakers are determined by each district</span></li>
</ul>
`;

test('district standings keep source order, both records, and the next opponent', () => {
  const table = parseDistrictStandings(html);
  assert.equal(table.district, 'District 15-6A');
  assert.deepEqual(table.rows.map((row) => row.team), [
    'Klein Bearkats',
    'Klein Cain Hurricanes',
    'Klein Collins Tigers',
  ]);
  assert.deepEqual(table.rows[1], {
    team: 'Klein Cain Hurricanes',
    district: '1–0',
    overall: '3–0',
    next: 'Magnolia West Mustangs',
  });
  assert.equal(table.rows[2].next, 'Idle');
});

test('overall records stay keyed by the full team name', () => {
  const records = parseDistrictRecords(html);
  assert.equal(records.get('Klein Bearkats'), '4–0');
  assert.equal(records.get('Klein Cain Hurricanes'), '3–0');
  assert.equal(records.get('Klein'), undefined);
});

test('a tie record is kept', () => {
  const tied = html.replace('2 - 0', '2 - 0 - 1').replace('4 - 0', '4 - 0 - 1');
  const [first] = parseDistrictStandings(tied).rows;
  assert.equal(first.district, '2–0–1');
  assert.equal(first.overall, '4–0–1');
});

test('a missing table is a failure, not an empty standing', () => {
  assert.throws(() => parseDistrictStandings('<html></html>'), /Standings table not found/);
});
