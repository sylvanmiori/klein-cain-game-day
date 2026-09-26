// Stress harness for the live-score ingest path (not part of `npm run test:score`).
// Run: node cloudflare/score-stress.mjs
// Feeds synthetic DCTF-shaped payloads (heavy `render` / `errorList` fields
// present AND absent) through the same strip -> extract -> parseScore path the
// cron uses, and reports wall time per payload size to reason about Worker CPU
// margins. Times are this machine's V8 wall clock, not Worker CPU-ms.
import assert from 'node:assert/strict';
import { parseScore, stripHeavyScoreFields, extractSchoolGames } from './score.mjs';

const SCHOOL = 'Klein Cain';
const OPPONENT = 'Magnolia West';
const game = { date: '2026-09-25', opponent: OPPONENT, home: false, kickoff: '7:00 PM' };

function renderHtml(bytes) {
  // Plain quotes; JSON.stringify escapes them to \" exactly like a wire payload.
  const chunk = '<tr><td class="score-cell" data-x="1"><a href="/scores/game">Klein Cain</a></td><td>58</td></tr>';
  return chunk.repeat(Math.max(1, Math.ceil(bytes / chunk.length))).slice(0, bytes);
}

function buildRows({ rows: rowCount, renderBytes, errorItems }) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const isTarget = i === Math.floor(rowCount / 2);
    rows.push({
      school: isTarget ? SCHOOL : `Decoy High ${i}`,
      opponent: isTarget ? OPPONENT : `Rival ${i}`,
      status: '4th Quarter',
      score: isTarget ? 58 : 14 + (i % 7),
      opponentScore: isTarget ? 7 : 7 + (i % 3),
      gameId: 100000 + i,
      location: 'Away',
      isDistrict: true,
      pick: 11,
      schoolTypeSortOrder: 1,
      ...(renderBytes > 0 ? { render: renderHtml(renderBytes) } : {}),
      ...(errorItems > 0
        ? { errorList: Array.from({ length: errorItems }, (_, j) => `Property not found for Column (col${j})`) }
        : {}),
    });
  }
  return rows;
}

function buildPayload(spec) {
  const data = JSON.stringify(buildRows(spec));
  return { payload: { d: JSON.stringify({ success: true, data }) }, dataSize: data.length };
}

function timed(label, fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`    ${label}: ${ms.toFixed(1)} ms`);
  return { result, ms };
}

const scenarios = [
  { name: 'tonight-scale (~2.5 MB)', rows: 1100, renderBytes: 2200, errorItems: 6 },
  { name: 'tonight-x2 (~5 MB)', rows: 2200, renderBytes: 2200, errorItems: 6 },
  { name: 'tonight-x4 heavy render (~10 MB)', rows: 1100, renderBytes: 8800, errorItems: 12 },
  { name: 'no heavy fields (~5 MB)', rows: 22000, renderBytes: 0, errorItems: 0 },
  { name: 'no heavy fields (~10 MB)', rows: 44000, renderBytes: 0, errorItems: 0 },
];

for (const s of scenarios) {
  const { payload, dataSize } = buildPayload(s);
  const mb = `${(dataSize / 1048576).toFixed(2)} MB`;
  console.log(`scenario: ${s.name} (data string ${mb})`);
  const dataText = JSON.parse(payload.d).data;

  const { result: stripped } = timed('stripHeavyScoreFields', () => stripHeavyScoreFields(dataText));
  assert.ok(!stripped.includes('"render"'), 'render must be gone');
  assert.ok(!stripped.includes('"errorList"'), 'errorList must be gone');

  const { result: rows } = timed('extractSchoolGames', () => extractSchoolGames(stripped, SCHOOL));
  assert.equal(rows.length, 1);

  const { result: parsed, ms } = timed('parseScore (full path)', () => parseScore(payload, game, SCHOOL));
  assert.equal(parsed.status, 'live');
  assert.equal(parsed.awayScore, 58);
  assert.equal(parsed.homeScore, 7);
  console.log(`    => correct score parsed in ${ms.toFixed(1)} ms total\n`);
}
console.log('All stress scenarios parsed the correct score.');
