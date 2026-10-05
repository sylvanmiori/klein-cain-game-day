import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDistrictRecords, parseDistrictStandings, parseMaxPrepsStandings } from './sources.mjs';

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

const maxprepsHtml = `
<table><tbody>
  <tr><td>1</td><td><div><span>Klein</span></div></td><td class="league-col">4-0</td><td class="league-col">1.000</td><td class="league-col">151</td><td class="league-col">48</td><td class="overall-col">6-0</td><td class="overall-col">1.000</td><td class="overall-col">210</td><td class="overall-col">51</td><td>6 W</td></tr>
  <tr><td>3</td><td><div><span>Klein Cain</span></div></td><td class="league-col">2-1</td><td class="league-col">0.667</td><td class="league-col">137</td><td class="league-col">85</td><td class="overall-col">4-1</td><td class="overall-col">0.800</td><td class="overall-col">224</td><td class="overall-col">146</td><td>1 L</td></tr>
  <tr><td>4</td><td><div><span>Some Unknown School</span></div></td><td class="league-col">0-4</td><td class="league-col">0.000</td><td class="league-col">10</td><td class="league-col">200</td><td class="overall-col">0-6</td><td class="overall-col">0.000</td><td class="overall-col">20</td><td class="overall-col">300</td><td>6 L</td></tr>
</tbody></table>
`;

test('maxpreps standings expand short names to full record keys', () => {
  const table = parseMaxPrepsStandings(maxprepsHtml);
  assert.equal(table.district, 'District 15-6A');
  assert.deepEqual(table.rows.map((row) => row.team), ['Klein Bearkats', 'Klein Cain Hurricanes']);
  assert.deepEqual(table.rows[1], {
    team: 'Klein Cain Hurricanes',
    district: '2–1',
    overall: '4–1',
    next: '',
  });
});

test('maxpreps standings drop schools outside the mascot map, never partial rows', () => {
  const table = parseMaxPrepsStandings(maxprepsHtml);
  assert.ok(table.rows.every((row) => row.team !== 'Some Unknown School'));
});

test('a missing maxpreps table is a failure, not an empty standing', () => {
  assert.throws(() => parseMaxPrepsStandings('<html></html>'), /Standings table not found/);
});
