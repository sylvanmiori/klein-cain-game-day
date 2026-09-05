import assert from 'node:assert/strict';
import test from 'node:test';
import { pickCurrent } from './season.mjs';

const editions = [
  { slug: 'humble', date: '2026-08-27' },
  { slug: 'oak-ridge', date: '2026-09-04' },
  { slug: 'tomball', date: '2026-09-18' },
  { slug: 'magnolia-west', date: '2026-09-25' },
];
const on = (day) => pickCurrent(editions, day).slug;

test('a played game holds the home page, then hands over', () => {
  assert.equal(on('2026-09-04'), 'oak-ridge', 'game day');
  assert.equal(on('2026-09-07'), 'oak-ridge', 'still current three days later');
  assert.equal(on('2026-09-08'), 'tomball', 'hands over to the next preview');
});

test('the upcoming game is current right up to kickoff', () => {
  assert.equal(on('2026-09-17'), 'tomball');
  assert.equal(on('2026-09-18'), 'tomball', 'game day must show the live card');
  assert.equal(on('2026-09-21'), 'tomball', 'result stays up over the weekend');
  assert.equal(on('2026-09-22'), 'magnolia-west');
});

test('before the season the first game is current', () => {
  assert.equal(on('2026-08-01'), 'humble');
});

test('after the last game it stays current rather than disappearing', () => {
  assert.equal(on('2026-12-01'), 'magnolia-west');
});

test('no editions yields null rather than throwing', () => {
  assert.equal(pickCurrent([], '2026-09-18'), null);
});
