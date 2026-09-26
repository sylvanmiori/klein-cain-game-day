import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterRosterDump,
  preferBoxscoreParse,
  isCloneBatRow,
  sumStat,
} from './boxscore-filter.mjs';

test('isCloneBatRow detects AB2 R1 H1 filler', () => {
  assert.equal(isCloneBatRow({ ab: 2, r: 1, h: 1 }), true);
  assert.equal(isCloneBatRow({ ab: 3, r: 1, h: 1 }), true);
  assert.equal(isCloneBatRow({ ab: 3, r: 2, h: 2 }), false);
  assert.equal(isCloneBatRow({ ab: 2, r: 0, h: 0 }), false);
});

test('filterRosterDump strips untrusted clones until sum matches our_score', () => {
  const batting = [
    { player: 'L Morris', jersey: 42, ab: 3, r: 2, h: 2 },
    { player: 'L Vannoy', jersey: 66, ab: 2, r: 1, h: 1 },
    { player: 'L Layton', jersey: 2, ab: 3, r: 0, h: 1, rbi: 3 },
    { player: 'T Barnes', jersey: 27, ab: 2, r: 0, h: 0 },
    { player: 'H Hampton', jersey: 7, ab: 2, r: 1, h: 1 },
    { player: 'B Bruce', jersey: 8, ab: 1, r: 0, h: 0 },
    { player: 'C Koehn', jersey: 9, ab: 1, r: 1, h: 1 },
    { player: 'E Ethan', jersey: 67, ab: 2, r: 0, h: 0 },
    { player: 'T Tyler', jersey: 6, ab: 2, r: 0, h: 1 },
    { player: 'W Weston', jersey: 13, ab: 1, r: 1, h: 1 },
    { player: 'J Lange', jersey: 23, ab: 2, r: 0, h: 0 },
    // fillers — sequential junk jerseys + clone stats
    { player: 'T Travis', jersey: 25, ab: 2, r: 1, h: 1 },
    { player: 'H Hale', jersey: 26, ab: 2, r: 1, h: 1 },
    { player: 'E Yates', jersey: 28, ab: 2, r: 1, h: 1 },
    { player: 'T Grisham', jersey: 29, ab: 2, r: 1, h: 1 },
    { player: 'R Delgadillo', jersey: 37, ab: 2, r: 1, h: 1 },
  ];
  const pitching = [
    { player: 'J Lange', jersey: 23, ip: 4.0, r: 5 },
    { player: 'R Delgadillo', jersey: 37, ip: 1.0, r: 0 },
  ];
  assert.equal(sumStat(batting, 'r'), 11);
  const { batting: outBat, pitching: outPit, meta } = filterRosterDump(batting, pitching, 7, 5);
  // Trusted photo rows in this fixture sum to 6 (Layton R digit often missed by vision);
  // filter must strip filler even when that leaves a residual sum gap.
  assert.equal(sumStat(outBat, 'r'), 6);
  assert.ok(outBat.length <= 11);
  assert.ok(!outBat.some(r => /Delgadillo|Yates|Grisham|Hale/i.test(r.player)));
  assert.ok(outBat.some(r => r.jersey === 42 && r.r === 2));
  assert.ok(meta.dropped_batting.length >= 4);
  assert.ok(!outPit.some(r => /Delgadillo/i.test(r.player)));
  assert.equal(sumStat(outPit, 'r'), 5);
});

test('filterRosterDump keeps trusted clone-looking rows (Vannoy 2/1/1)', () => {
  const batting = [
    { player: 'L Morris', jersey: 42, ab: 3, r: 2, h: 2 },
    { player: 'L Vannoy', jersey: 66, ab: 2, r: 1, h: 1 },
    { player: 'H Hampton', jersey: 7, ab: 2, r: 1, h: 1 },
    { player: 'C Koehn', jersey: 9, ab: 1, r: 1, h: 1 },
    { player: 'W Weston', jersey: 13, ab: 1, r: 1, h: 1 },
    { player: 'E Yates', jersey: 28, ab: 2, r: 1, h: 1 },
    { player: 'R Delgadillo', jersey: 37, ab: 2, r: 1, h: 1 },
  ];
  const { batting: out } = filterRosterDump(batting, [], 6, 5);
  assert.equal(sumStat(out, 'r'), 6);
  assert.ok(out.some(r => r.jersey === 66));
  assert.ok(!out.some(r => /Yates|Delgadillo/i.test(r.player)));
});

test('preferBoxscoreParse does not prefer longer dump on tied issues', () => {
  const first = { batting: [{ r: 1 }, { r: 1 }] };
  const audited = { batting: [{ r: 1 }, { r: 1 }, { r: 1 }, { r: 1 }] };
  const check = { issues: ['sum mismatch'] };
  const { parsed, reason } = preferBoxscoreParse(first, check, audited, check);
  assert.equal(parsed, first);
  assert.equal(reason, 'keep_first_tie');
});

test('preferBoxscoreParse takes audit when fewer issues', () => {
  const first = { batting: [{ r: 1 }] };
  const audited = { batting: [{ r: 7 }] };
  const { parsed, reason } = preferBoxscoreParse(
    first,
    { issues: ['a', 'b'] },
    audited,
    { issues: ['a'] },
  );
  assert.equal(parsed, audited);
  assert.equal(reason, 'audit_fewer_issues');
});
