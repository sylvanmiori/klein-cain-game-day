import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPreviewIntroFacts,
  ordinalSeason,
  schoolPointsPerGame,
  schoolShortLabel,
} from './preview-facts.mjs';

const publication = { schoolName: 'Klein Cain' };
const seasonData = {
  results: {
    '2026-08-27': { outcome: 'W', us: 42, them: 41 },
    '2026-09-04': { outcome: 'W', us: 45, them: 20 },
    '2026-09-18': { outcome: 'W', us: 55, them: 38 },
    '2026-09-25': { outcome: 'W', us: 58, them: 7 },
  },
  standings: {
    rows: [
      { team: 'Klein Collins Tigers', district: '3–0', overall: '4–1' },
      { team: 'Klein Cain Hurricanes', district: '2–0', overall: '4–0' },
    ],
  },
};
const coaches = {
  opponents: {
    'Klein Collins': { name: 'Adrian Mitchell', season: 9 },
  },
};

void test('schoolShortLabel and PPG helpers', () => {
  assert.equal(schoolShortLabel('Klein Cain'), 'Cain');
  assert.equal(ordinalSeason(9), '9th season');
  assert.equal(ordinalSeason(1), '1st season');
  assert.equal(ordinalSeason(22), '22nd season');
  assert.equal(schoolPointsPerGame(seasonData.results), 50);
});

void test('buildPreviewIntroFacts for Week 5-style preview', () => {
  const edition = {
    home: { name: 'Klein Cain', mascot: 'Hurricanes', record: '4–0' },
    away: { name: 'Klein Collins', mascot: 'Tigers', record: '4–1' },
    prediction: { margin: -8, asOf: '2026-09-30T12:00:00Z' },
  };
  const facts = buildPreviewIntroFacts({
    edition,
    publication,
    seasonData,
    coaches,
    opponentKey: 'Klein Collins',
    now: Date.parse('2026-10-01T12:00:00Z'),
  });
  assert.deepEqual(facts, [
    { label: 'Cain', value: '4–0 · 2–0 district · 50.0 points/game', team: 'school' },
    { label: 'Klein Collins', value: '4–1 · 3–0 district', team: 'opponent' },
    { label: 'Pick', value: 'Klein Collins by 8', team: 'opponent' },
    { label: 'Klein Collins coach', value: 'Adrian Mitchell · 9th season', team: 'opponent' },
  ]);
});

void test('an old model pick is omitted from the preview facts', () => {
  const edition = {
    home: { name: 'Klein Cain', mascot: 'Hurricanes', record: '4–0' },
    away: { name: 'Klein Collins', mascot: 'Tigers', record: '4–1' },
    prediction: { margin: -8, asOf: '2026-09-20T12:00:00Z' },
  };
  const facts = buildPreviewIntroFacts({
    edition, publication, seasonData, coaches, opponentKey: 'Klein Collins',
    now: Date.parse('2026-10-01T12:00:00Z'),
  });
  assert.equal(facts.some((fact) => fact.label === 'Pick'), false);
});
