import assert from 'node:assert/strict';
import test from 'node:test';
import { mondayOfGameWeek, pickCurrent } from './season.mjs';

const editions = [
  { slug: 'humble', date: '2026-08-27' },
  { slug: 'oak-ridge', date: '2026-09-04' },
  { slug: 'tomball', date: '2026-09-18' },
  { slug: 'magnolia-west', date: '2026-09-25' },
];
const on = (day) => pickCurrent(editions, day).slug;

test('Monday of game week anchors promotion', () => {
  assert.equal(mondayOfGameWeek('2026-09-18'), '2026-09-14');
  assert.equal(mondayOfGameWeek('2026-09-25'), '2026-09-21');
});

test('a final holds the home page until Monday of the next game week', () => {
  assert.equal(on('2026-09-04'), 'oak-ridge', 'game day');
  assert.equal(on('2026-09-13'), 'oak-ridge', 'latest final stays useful through the open week');
  assert.equal(on('2026-09-14'), 'tomball', 'next preview takes over Monday of game week');
});

test('the upcoming game owns promotion Monday through game day', () => {
  assert.equal(on('2026-09-14'), 'tomball');
  assert.equal(on('2026-09-18'), 'tomball', 'game day must show the live card');
  assert.equal(on('2026-09-20'), 'tomball', 'result remains until the next promotion Monday');
  assert.equal(on('2026-09-21'), 'magnolia-west');
});

test('today\'s game wins over tomorrow\'s preview for consecutive games', () => {
  const consecutive = [
    { slug: 'today', date: '2026-09-18' },
    { slug: 'tomorrow', date: '2026-09-19' },
  ];
  assert.equal(pickCurrent(consecutive, '2026-09-18').slug, 'today');
  assert.equal(pickCurrent(consecutive, '2026-09-19').slug, 'tomorrow');
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
