import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findBracketGameForSchedule,
  findBracketResult,
  flattenBracketGames,
  isBracketGameFinal,
  normalizeBracketTime,
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

describe('bracket finals for schedule rows', () => {
  it('matches AMP QF by date, time, field and opponent', () => {
    const games = flattenBracketGames(snapshot);
    assert.equal(findBracketGameForSchedule(ampSchedule, [ampSchedule], games)?.game_number, 39);
    assert.equal(findBracketResult(ampSchedule, [ampSchedule], games), 'W 9-8');
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
