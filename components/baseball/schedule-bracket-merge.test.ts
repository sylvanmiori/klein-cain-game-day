import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bracketGameToScheduleRow,
  isBracketPlaceholderName,
  mergeScheduleWithBracketGames,
} from './live-bracket.ts';
import type { LiveBracketGame, LiveBracketSnapshot, ScheduleGame } from './types.ts';

const OCT_EVENT = '140496';
const TOURNAMENT_ID = 't1';

/** Octoberfest rows as loadSchedule() serves them on Schedule + This Weekend (multi-park field prefix). */
const ampRow: ScheduleGame = {
  id: 't1-g3',
  date: '2026-10-11',
  time: '12:40 PM',
  opponent: 'AMP Academy - 15u',
  homeAway: 'home',
  tournamentId: TOURNAMENT_ID,
  venue: 'Premier Baseball of Texas',
  field: 'Premier Baseball of Texas \u00B7 Field 7',
  result: null,
  diamondkastUrl: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597473',
};

const sfBracketGame: LiveBracketGame = {
  game_number: 42,
  round: 'Semifinal',
  date: '2026-10-11',
  time: '5:20 PM',
  field: 'PLAY BY PLAY | Field 7',
  venue: 'Premier Baseball of Texas',
  pg_game_id: '1597476',
  home: { seed: '#2', name: '4:13 Baseball', score: null },
  away: { seed: '#3', name: 'Canes Houston - 15U', score: null },
  winner: null,
};

const ampBracketFinal: LiveBracketGame = {
  game_number: 39,
  date: '2026-10-11',
  time: '12:40 PM',
  field: 'GAME RECAP | Field 7',
  venue: 'Premier Baseball of Texas',
  pg_game_id: '1597473',
  home: { name: '4:13 Baseball', score: 9 },
  away: { name: 'AMP Academy - 15u', score: 8 },
  winner: 'home',
};

const snapshot: LiveBracketSnapshot = {
  schemaVersion: 1,
  event_id: OCT_EVENT,
  tiers: [
    {
      tier: 'Bronze Bracket',
      games: [ampBracketFinal, sfBracketGame],
    },
  ],
  game_count: 2,
  scraped_at: '2026-10-11T20:00:00.000Z',
  source: 'Perfect Game',
};

describe('isBracketPlaceholderName', () => {
  it('rejects Winner-of feeders and seed placeholders', () => {
    assert.equal(isBracketPlaceholderName('Winner of Game #39'), true);
    assert.equal(isBracketPlaceholderName('Seed #4'), true);
    assert.equal(isBracketPlaceholderName('Canes Houston - 15U'), false);
  });
});

describe('mergeScheduleWithBracketGames', () => {
  it('appends SF #42 when only AMP is on the static schedule', () => {
    const schielRow: ScheduleGame = {
      id: 't1-schiel',
      date: '2026-10-10',
      opponent: '15U OFFSEASON BASEBALL - WESTBROOKS',
      tournamentId: TOURNAMENT_ID,
      venue: 'Schiel Road Park',
      field: 'Schiel Road Park \u00B7 Field 4',
    };
    const base = [schielRow, ampRow];
    const merged = mergeScheduleWithBracketGames(base, snapshot, OCT_EVENT, TOURNAMENT_ID);
    assert.equal(merged.length, 3);
    const sf = merged.find((g) => g.opponent.includes('Canes'));
    assert.ok(sf);
    assert.equal(sf?.time, '5:20 PM');
    assert.equal(sf?.field, 'Premier Baseball of Texas \u00B7 Field 7');
    assert.equal(sf?.diamondkastUrl?.includes('1597476'), true);
  });

  it('does not duplicate AMP when schedule and bracket both list gameid 1597473', () => {
    const canesStatic: ScheduleGame = {
      id: 't1-g4',
      date: '2026-10-11',
      time: '5:20 PM',
      opponent: 'Canes Houston - 15U',
      homeAway: 'home',
      tournamentId: TOURNAMENT_ID,
      venue: 'Premier Baseball of Texas',
      field: 'Field 7',
      diamondkastUrl: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597476',
    };
    const merged = mergeScheduleWithBracketGames(
      [ampRow, canesStatic],
      snapshot,
      OCT_EVENT,
      TOURNAMENT_ID,
    );
    assert.equal(merged.length, 2);
  });

  it('skips feeder games where 4:13 is not named yet', () => {
    const feederOnly: LiveBracketSnapshot = {
      ...snapshot,
      tiers: [
        {
          tier: 'Bronze Bracket',
          games: [
            {
              game_number: 43,
              date: '2026-10-11',
              time: '7:40 PM',
              field: 'Field 7',
              home: { name: 'Winner of Game #41' },
              away: { name: 'Winner of Game #42' },
            },
          ],
        },
      ],
    };
    const merged = mergeScheduleWithBracketGames([ampRow], feederOnly, OCT_EVENT, TOURNAMENT_ID);
    assert.equal(merged.length, 1);
  });
});

describe('bracketGameToScheduleRow', () => {
  it('builds a vs Canes semifinal row from live bracket shape', () => {
    const row = bracketGameToScheduleRow(sfBracketGame, TOURNAMENT_ID);
    assert.ok(row);
    assert.equal(row.opponent, 'Canes Houston - 15U');
    assert.equal(row.field, 'Field 7');
    assert.equal(row.note, 'Semifinal');
  });
});
