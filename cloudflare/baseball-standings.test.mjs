import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  absolutizePgUrl,
  buildStandingsSnapshot,
  parsePoolStandingsPage,
  STANDINGS_URL_FOR,
} from './baseball-standings.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(ROOT, 'baseball-standings.fixture.html'), 'utf8');

describe('parsePoolStandingsPage', () => {
  const parsed = parsePoolStandingsPage(fixture, {
    standingsUrl: STANDINGS_URL_FOR(140434),
    teamName: '4:13 Baseball',
  });

  it('finds Pool A with three standings teams (ignores DiamondKast)', () => {
    assert.equal(parsed.pools.length, 1);
    assert.equal(parsed.pools[0].pool, 'Pool A');
    assert.equal(parsed.pools[0].teams.length, 3);
  });

  it('parses Nitro row with TX state and numeric W/L/T (not Game Recap)', () => {
    const nitro = parsed.pools[0].teams[0];
    assert.equal(nitro.name, 'Nitro baseball Ortiz 15u');
    assert.equal(nitro.seed, 1);
    assert.equal(nitro.state, 'TX');
    assert.notEqual(nitro.state, 'Game Recap');
    assert.equal(nitro.pct, 1);
    assert.equal(nitro.w, 1);
    assert.equal(nitro.l, 0);
    assert.equal(nitro.t, 0);
    assert.equal(nitro.ra, 1);
    assert.equal(nitro.rs, 5);
    assert.match(nitro.team_url, /^https:\/\/www\.perfectgame\.org\//);
  });

  it('finds 4:13 Baseball with sensible ST=TX and numeric W/L/T', () => {
    const ours = parsed.pools[0].teams.find((t) => t.name === '4:13 Baseball');
    assert.ok(ours);
    assert.equal(ours.state, 'TX');
    assert.equal(typeof ours.w, 'number');
    assert.equal(typeof ours.l, 'number');
    assert.equal(typeof ours.t, 'number');
    assert.equal(parsed.team_record?.pool, 'Pool A');
    assert.equal(parsed.team_record?.seed, ours.seed);
    assert.equal(parsed.team_record?.w, ours.w);
  });
});

describe('helpers', () => {
  it('STANDINGS_URL_FOR builds the events URL', () => {
    assert.equal(
      STANDINGS_URL_FOR(140434),
      'https://www.perfectgame.org/events/TournamentPoolStandings.aspx?event=140434',
    );
  });

  it('absolutizePgUrl resolves relative team links', () => {
    assert.equal(
      absolutizePgUrl('Tournaments/Teams/Default.aspx?team=1173262'),
      'https://www.perfectgame.org/events/Tournaments/Teams/Default.aspx?team=1173262',
    );
  });

  it('buildStandingsSnapshot shapes the KV payload', () => {
    const parsed = parsePoolStandingsPage(fixture, {
      standingsUrl: STANDINGS_URL_FOR(140434),
      teamName: '4:13 Baseball',
    });
    const snap = buildStandingsSnapshot({
      eventId: 140434,
      tournamentName: 'Test Tourney',
      standingsUrl: parsed.standings_url,
      pools: parsed.pools,
      teamRecord: parsed.team_record,
      scrapedAt: '2026-09-26T21:00:00.000Z',
    });
    assert.equal(snap.schemaVersion, 1);
    assert.equal(snap.event_id, '140434');
    assert.equal(snap.source, 'Perfect Game');
    assert.equal(snap.pools[0].teams.length, 3);
    assert.equal(snap.team_record.name, undefined); // record is W/L shape, not full team
    assert.equal(snap.team_record.pool, 'Pool A');
  });
});
