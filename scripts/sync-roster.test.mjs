import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMaxPrepsRoster } from './sync-roster.mjs';

test('parseMaxPrepsRoster keeps only the varsity list with unique numbers', () => {
  const html = readFileSync(new URL('../fixtures/maxpreps-roster-sample.html', import.meta.url), 'utf8');
  const { players, updated } = parseMaxPrepsRoster(html);
  assert.equal(players.length, 66);
  assert.match(updated, /2026/);
  assert.equal(new Set(players.map((player) => player.number)).size, 66);
  assert.ok(players.some((player) => player.name === 'Jace Hanks' && player.number === 9));
  assert.ok(!players.some((player) => player.name === 'Jackson Bonin'));
});
