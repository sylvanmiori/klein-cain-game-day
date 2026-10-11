import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findBracketGameForSchedule,
  findBracketResult,
  flattenBracketGames,
  isBracketGameFinal,
  normalizeBracketTime,
  normalizeFieldKey,
  resultFromBracketFor413,
} from './live-bracket.ts';
import type { LiveBracketGame, LiveBracketSnapshot, ScheduleGame } from './types.ts';

const ampSchedule: ScheduleGame = {
  id: 'oct-amp',
  date: '2026-10-11',
  time: '12:40 PM',
  opponent: 'AMP Academy - 15u',
  field: 'Field 7',
  diamondkastUrl: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597473',
};

const ampBracket: LiveBracketGame = {
  game_number: 39,
  round: 'Quarterfinal',
  date: '2026-10-11',
  time: '12:40 PM',
  field: 'Field 7',
  venue: 'Premier Baseball of Texas',
  home: { seed: '#2', name: '4:13 Baseball', score: 9 },
  away: { seed: '#7', name: 'AMP Academy - 15u', score: 8 },
  winner: 'home',
};

const snapshot: LiveBracketSnapshot = {
  schemaVersion: 1,
  event_id: '140496',
  tiers: [{ tier: 'Bronze Bracket', games: [ampBracket] }],
  game_count: 1,
  scraped_at: '2026-10-11T18:00:00.000Z',
  source: 'Perfect Game',
};

describe('normalizeBracketTime', () => {
  it('normalizes leading-zero differences', () => {
    assert.equal(normalizeBracketTime('12:40 PM'), normalizeBracketTime('12:40 PM'));
  });
});

describe('normalizeFieldKey', () => {
  it('strips venue and recap prefixes down to field number', () => {
    assert.equal(
      normalizeFieldKey('Premier Baseball of Texas \u00B7 Field 7'),
      'field 7',
    );
    assert.equal(normalizeFieldKey('GAME RECAP | Field 7'), 'field 7');
    assert.equal(normalizeFieldKey('PLAY BY PLAY | Field 7'), 'field 7');
  });
});

describe('bracket finals for schedule rows', () => {
  it('matches AMP QF by date, time, field and opponent', () => {
    const games = flattenBracketGames(snapshot);
    assert.equal(findBracketGameForSchedule(ampSchedule, [ampSchedule], games)?.game_number, 39);
    assert.equal(findBracketResult(ampSchedule, [ampSchedule], games), 'W 9-8');
  });

  it('matches live Schedule + This Weekend row shapes (venue-prefixed field vs GAME RECAP)', () => {
    const schedulePageRow: ScheduleGame = {
      id: 't1-g2',
      date: '2026-10-11',
      time: '12:40 PM',
      opponent: 'AMP Academy - 15u',
      homeAway: 'home',
      tournamentId: 't1',
      venue: 'Premier Baseball of Texas',
      field: 'Premier Baseball of Texas \u00B7 Field 7',
      result: null,
      diamondkastUrl:
        'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597473',
    };
    const bracketApiGame: LiveBracketGame = {
      game_number: 39,
      round: 'Quarterfinal',
      date: '2026-10-11',
      time: '12:40 PM',
      field: 'GAME RECAP | Field 7',
      venue: 'Premier Baseball of Texas',
      pg_game_id: '1597473',
      home: { seed: '#2', name: '4:13 Baseball', score: 9 },
      away: { seed: '#7', name: 'AMP Academy - 15u', score: 8 },
      winner: 'home',
    };
    const siblings = [schedulePageRow];
    assert.equal(
      findBracketResult(schedulePageRow, siblings, [bracketApiGame]),
      'W 9-8',
    );
  });

  it('matches on PG game id when schedule and bracket both carry gameid=1597473', () => {
    const row: ScheduleGame = {
      id: 't1-g2',
      date: '2026-10-11',
      time: '12:40 PM',
      opponent: 'AMP Academy - 15u',
      diamondkastUrl:
        'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597473',
    };
    const bracketGame: LiveBracketGame = {
      game_number: 39,
      pg_game_id: '1597473',
      home: { name: '4:13 Baseball', score: 9 },
      away: { name: 'AMP Academy - 15u', score: 8 },
      winner: 'home',
    };
    assert.equal(findBracketResult(row, [row], [bracketGame]), 'W 9-8');
  });

  it('treats posted scores without winner as final', () => {
    const game: LiveBracketGame = {
      ...ampBracket,
      winner: null,
    };
    assert.equal(isBracketGameFinal(game), true);
    assert.equal(resultFromBracketFor413(ampSchedule, game), 'W 9-8');
  });

  it('does not invent a result for unfinished bracket games', () => {
    const upcoming: LiveBracketGame = {
      ...ampBracket,
      home: { ...ampBracket.home, score: null },
      away: { ...ampBracket.away, score: null },
      winner: null,
    };
    assert.equal(findBracketResult(ampSchedule, [ampSchedule], [upcoming]), null);
  });

  it('rejects ambiguous same-day doubleheaders on the schedule', () => {
    const sibling = { ...ampSchedule, id: 'oct-amp-2' };
    const games = flattenBracketGames(snapshot);
    assert.equal(findBracketResult(ampSchedule, [ampSchedule, sibling], games), null);
  });
});

describe('preserves distinct Sep 26 pool games', () => {
  const tsb: ScheduleGame = {
    id: 'tsb',
    date: '2026-09-26',
    opponent: 'TSB',
    homeAway: 'away',
  };
  const williams: ScheduleGame = {
    id: 'williams',
    date: '2026-09-26',
    opponent: '15U OFFSEASON BASEBALL - WILLIAMS',
    homeAway: 'home',
  };
  const bracketOnly: LiveBracketGame[] = [
    {
      game_number: 99,
      date: '2026-10-11',
      time: '12:40 PM',
      home: { name: '4:13 Baseball', score: 9 },
      away: { name: 'AMP Academy - 15u', score: 8 },
      winner: 'home',
    },
  ];

  it('does not attach Octoberfest finals to September pool rows', () => {
    assert.equal(findBracketResult(tsb, [tsb, williams], bracketOnly), null);
    assert.equal(findBracketResult(williams, [tsb, williams], bracketOnly), null);
  });
});
