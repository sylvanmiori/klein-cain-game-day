import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER_OF_GAME_MODEL, selectPlayerOfGame } from './player-of-game.mjs';

test('combines a two-way offensive line before choosing the player', () => {
  const result = selectPlayerOfGame([
    { name: 'Jace Hanks', number: '9', image: '/players/jace-hanks.jpg', passingYards: 71, passingTouchdowns: 1, rushingYards: 104 },
    { name: 'Israel Smith', number: '8', receivingYards: 46, receivingTouchdowns: 1 },
    { name: 'Easton Mizell', number: '47', totalTackles: 12 },
  ]);
  assert.deepEqual(result, {
    name: 'Jace Hanks',
    number: '9',
    image: '/players/jace-hanks.jpg',
    headline: '175 yards of offense · 1 TD',
    rationale: 'Hanks finished with 71 passing yards and 1 passing touchdown, and 104 rushing yards.',
    model: PLAYER_OF_GAME_MODEL,
  });
});

test('takeaways and backfield plays can make a defender the choice', () => {
  const result = selectPlayerOfGame([
    { name: 'Runner One', number: '1', rushingYards: 95 },
    { name: 'Safety Two', number: '2', totalTackles: 8, tacklesForLoss: 2, defensiveInterceptions: 1 },
  ]);
  assert.equal(result.name, 'Safety Two');
  assert.equal(result.headline, '8 tackles · 3 impact plays');
});

test('a penalty for interceptions keeps passing volume from deciding by itself', () => {
  const result = selectPlayerOfGame([
    { name: 'Quarterback', number: '9', passingYards: 250, passingInterceptions: 3 },
    { name: 'Runner', number: '16', rushingYards: 110, rushingTouchdowns: 1 },
  ]);
  assert.equal(result.name, 'Runner');
});

test('returns null rather than inventing a player from empty statistics', () => {
  assert.equal(selectPlayerOfGame([]), null);
  assert.equal(selectPlayerOfGame([{ name: 'No Stats', number: '0' }]), null);
});
