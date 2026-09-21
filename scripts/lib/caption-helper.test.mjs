import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLowQualityCaption,
  resolvePlayerByNumber,
  formatPlayerJournalismStyle,
} from './caption-helper.mjs';

const mockRoster = {
  players: [
    { number: 1, name: 'Earl Oguinn Jr.', position: 'RB / WR', class: 'Jr.' },
    { number: 2, name: 'Michael Elhindi', position: 'DB', class: 'Sr.' },
    { number: 9, name: 'Jace Hanks', position: 'QB', class: 'Jr.' },
    { number: 10, name: 'Cooper Karns', position: 'WR', class: 'Sr.' },
    { number: 16, name: 'Eyan Johnson', position: 'RB / SB', class: 'Sr.' },
    { number: 63, name: 'Clayton Rightmer', position: 'OL', class: 'Sr.' },
    { number: 69, name: 'Gavin Chaloupka', position: 'OL', class: 'Jr.' },
  ],
};

test('detectLowQualityCaption catches generic "Jersey X" patterns', () => {
  assert.ok(detectLowQualityCaption('Jersey 1 turns upfield with the ball.'));
  assert.ok(detectLowQualityCaption('Jersey 69 sets for the snap.'));
  assert.ok(detectLowQualityCaption('Jerseys 10, 9 and 23 on the sideline.'));
  assert.ok(detectLowQualityCaption('Klein Cain ball carrier in jersey 1 running with the football'));
  assert.ok(detectLowQualityCaption('Klein Cain defender in jersey 2 pursuing a Tomball ball carrier'));
  assert.ok(detectLowQualityCaption('#1 turns upfield with the football'));
});

test('detectLowQualityCaption passes journalistic captions that identify players', () => {
  assert.equal(
    detectLowQualityCaption('Junior running back Earl Oguinn Jr. (1) bursts down the sideline on a big gain.'),
    null
  );
  assert.equal(
    detectLowQualityCaption('Senior defensive back Michael Elhindi (2) tracks down a Tomball ball carrier.'),
    null
  );
  assert.equal(
    detectLowQualityCaption('Quarterback Jace Hanks (9) celebrates a score with running back Eyan Johnson (16).'),
    null
  );
  assert.equal(
    detectLowQualityCaption('Head coach John Shuman gathers the Hurricanes in the postgame huddle.'),
    null
  );
  assert.equal(
    detectLowQualityCaption('Klein Cain Principal Nicole Patin congratulates the 2026 Homecoming King and Queen.'),
    null
  );
});

test('resolvePlayerByNumber finds players from the roster', () => {
  const p1 = resolvePlayerByNumber(mockRoster, 1);
  assert.equal(p1?.name, 'Earl Oguinn Jr.');
  assert.equal(p1?.position, 'RB / WR');
  assert.equal(p1?.class, 'Jr.');

  const p63 = resolvePlayerByNumber(mockRoster, '63');
  assert.equal(p63?.name, 'Clayton Rightmer');
  assert.equal(p63?.position, 'OL');

  assert.equal(resolvePlayerByNumber(mockRoster, 999), null);
});

test('formatPlayerJournalismStyle generates high-quality player references', () => {
  const p1 = resolvePlayerByNumber(mockRoster, 1);
  assert.equal(formatPlayerJournalismStyle(p1), 'Junior running back Earl Oguinn Jr. (1)');

  const p2 = resolvePlayerByNumber(mockRoster, 2);
  assert.equal(formatPlayerJournalismStyle(p2), 'Senior defensive back Michael Elhindi (2)');

  const p9 = resolvePlayerByNumber(mockRoster, 9);
  assert.equal(formatPlayerJournalismStyle(p9), 'Junior quarterback Jace Hanks (9)');
});
