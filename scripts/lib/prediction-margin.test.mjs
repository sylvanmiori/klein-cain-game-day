import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatFavoriteMargin,
  marginFromSchoolPerspective,
  schoolMarginForPublishedPick,
} from './prediction-margin.mjs';

test('our rating margin is from the home team; flip sign when Cain is away', () => {
  const home = 'Klein Forest';
  const away = 'Klein Cain';
  const school = 'Klein Cain';
  const stored = -25.77;
  const schoolMargin = marginFromSchoolPerspective(home, away, school, stored, 'home');
  assert.ok(schoolMargin > 0);
  const { value } = formatFavoriteMargin(schoolMargin, school, home);
  assert.equal(value, 'Klein Cain by 26');
});

test('our rating needs no flip when Cain is home', () => {
  const home = 'Klein Cain';
  const away = 'Klein Oak';
  const school = 'Klein Cain';
  const stored = 10.69;
  const schoolMargin = marginFromSchoolPerspective(home, away, school, stored, 'home');
  assert.equal(Math.round(schoolMargin), 11);
  const { value } = formatFavoriteMargin(schoolMargin, school, away);
  assert.equal(value, 'Klein Cain by 11');
});

test('Dave Campbell pick is already from the school perspective', () => {
  const schoolMargin = marginFromSchoolPerspective(
    'Klein Forest',
    'Klein Cain',
    'Klein Cain',
    23,
    'school',
  );
  assert.equal(schoolMargin, 23);
});

test('schoolMarginForPublishedPick picks the right basis', () => {
  const edition = {
    home: { name: 'Klein Forest' },
    away: { name: 'Klein Cain' },
    rating: { margin: -25.77 },
    prediction: { margin: 23 },
  };
  assert.equal(
    Math.round(schoolMarginForPublishedPick(edition, 'Klein Cain', edition.rating)),
    26,
  );
  assert.equal(
    schoolMarginForPublishedPick(edition, 'Klein Cain', edition.prediction),
    23,
  );
});
