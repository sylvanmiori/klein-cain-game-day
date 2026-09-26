import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignRounds,
  buildSnapshot,
  deriveWinner,
  parseBracketsPage,
  pickWeekendTournament,
  roundLabel,
  sideLabel,
} from './baseball-bracket.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(ROOT, 'baseball-bracket.fixture.html'), 'utf8');
// Real Gold Bracket table captured from
// https://www.perfectgame.org/events/Brackets.aspx?event=140434 on 2026-09-26
// (pre-games: seeds as placeholders, no scores posted yet).
const TOURNAMENT = { name: '2026 15U PG Backyard Brawl @ Premier', start_date: '2026-09-26', end_date: '2026-09-27', event_id: 140434 };

describe('parseBracketsPage (real Gold Bracket table)', () => {
  const tiers = parseBracketsPage(fixture, TOURNAMENT);

  it('finds the Gold tier', () => {
    assert.equal(tiers.length, 1);
    assert.equal(tiers[0].tier, 'Gold Bracket');
  });

  it('extracts all six games with numbers, dates and venues', () => {
    const games = tiers[0].games;
    assert.equal(games.length, 6);
    const numbers = games.map((g) => g.game_number).sort((a, b) => a - b);
    assert.deepEqual(numbers, [20, 21, 22, 23, 24, 25]);
    for (const g of games) {
      assert.equal(g.date, '2026-09-27');
      assert.match(g.time, /^\d{1,2}:\d{2} [AP]M$/);
      assert.equal(g.field, 'Field 7');
      assert.equal(g.venue, 'Premier Baseball of Texas');
    }
  });

  it('parses seeds and placeholder names from team boxes', () => {
    const byNum = new Map(tiers[0].games.map((g) => [g.game_number, g]));
    const gm20 = byNum.get(20);
    assert.equal(gm20.home.seed, '#4');
    assert.equal(gm20.home.name, 'Seed #4');
    assert.equal(gm20.away.seed, '#5');
    assert.equal(gm20.away.name, 'Seed #5');
    const gm25 = byNum.get(25);
    assert.equal(gm25.home.name, 'Winner of Game #23');
    assert.equal(gm25.away.name, 'Winner of Game #24');
  });

  it('leaves scores null before games are played', () => {
    for (const g of tiers[0].games) {
      assert.equal(g.home.score, null);
      assert.equal(g.away.score, null);
    }
  });
});

describe('assignRounds', () => {
  const games = assignRounds(parseBracketsPage(fixture, TOURNAMENT)[0].games);
  const byNum = new Map(games.map((g) => [g.game_number, g.round]));

  it('labels the final as Championship', () => {
    assert.equal(byNum.get(25), 'Championship');
  });

  it('labels feeders one round out', () => {
    assert.equal(byNum.get(23), 'Semifinal');
    assert.equal(byNum.get(24), 'Semifinal');
    assert.equal(byNum.get(20), 'Quarterfinal');
    assert.equal(byNum.get(21), 'Quarterfinal');
    assert.equal(byNum.get(22), 'Quarterfinal');
  });

  it('falls back to Round N for deep brackets', () => {
    assert.equal(roundLabel(5), 'Round 5');
  });
});

describe('scores and winners', () => {
  // Inject final scores into GM 20 (slot 1): home 5, away 3.
  const scored = fixture
    .replace('lblHomeScorePos1_0">', 'lblHomeScorePos1_0">5')
    .replace('lblVisitorScorePos1_3">', 'lblVisitorScorePos1_3">3');
  const games = parseBracketsPage(scored, TOURNAMENT)[0].games;
  const gm20 = games.find((g) => g.game_number === 20);

  it('parses integer scores from the page', () => {
    assert.equal(gm20.home.score, 5);
    assert.equal(gm20.away.score, 3);
  });

  it('derives the winner only from posted scores', () => {
    assert.equal(deriveWinner(gm20), 'home');
    const unplayed = games.find((g) => g.game_number === 21);
    assert.equal(deriveWinner(unplayed), null);
    assert.equal(deriveWinner({ home: { score: 4 }, away: { score: 4 } }), null);
    assert.equal(deriveWinner({ home: { score: null }, away: { score: 2 } }), null);
  });

  it('never invents a name for an empty side', () => {
    assert.equal(sideLabel({ seed: null, name: null }), 'TBD');
    assert.equal(sideLabel({ seed: '#4', name: 'Seed #4' }), '#4 Seed #4');
  });
});

describe('pickWeekendTournament', () => {
  const tournaments = [
    { name: 'Backyard Brawl', start_date: '2026-09-26', end_date: '2026-09-27', event_id: 140434 },
    { name: 'October Classic', start_date: '2026-10-10', end_date: '2026-10-11', event_id: 140999 },
  ];

  it('finds the tournament covering today', () => {
    const t = pickWeekendTournament(tournaments, new Date('2026-09-26T14:00:00-05:00'));
    assert.equal(t?.event_id, 140434);
  });

  it('returns null when nothing covers the weekend', () => {
    assert.equal(pickWeekendTournament(tournaments, new Date('2026-10-03T14:00:00-05:00')), null);
    assert.equal(pickWeekendTournament([], new Date('2026-09-26T14:00:00-05:00')), null);
  });
});

describe('buildSnapshot', () => {
  const tiers = parseBracketsPage(fixture, TOURNAMENT).map(({ tier, games }) => ({ tier, games: assignRounds(games) }));
  const snapshot = buildSnapshot({
    eventId: 140434,
    tournamentName: TOURNAMENT.name,
    bracketUrl: 'https://www.perfectgame.org/events/Brackets.aspx?event=140434',
    tiers,
    scrapedAt: '2026-09-26T19:00:00.000Z',
  });

  it('produces the documented snapshot shape', () => {
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.event_id, '140434');
    assert.equal(snapshot.source, 'Perfect Game');
    assert.equal(snapshot.game_count, 6);
    assert.equal(snapshot.tiers.length, 1);
    const game = snapshot.tiers[0].games.find((g) => g.game_number === 25);
    assert.equal(game.round, 'Championship');
    assert.equal(game.winner, null);
    assert.deepEqual(Object.keys(game.home).sort(), ['name', 'score', 'seed']);
  });
});
