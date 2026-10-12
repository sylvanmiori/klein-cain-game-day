import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSeasonRecord } from './live-bracket.ts';
import type {
  ApiGame,
  BaseballSchedule,
  LiveBracketGame,
  LiveBracketSnapshot,
  ScheduleGame,
} from './types.ts';

const BRAWL_ID = 't0';
const OCT_ID = 't1';
const OCT_EVENT = '140496';

const brawlGames: ScheduleGame[] = [
  {
    id: 'bb-tsb',
    date: '2026-09-26',
    opponent: 'TSB',
    homeAway: 'away',
    tournamentId: BRAWL_ID,
  },
  {
    id: 'bb-williams',
    date: '2026-09-26',
    opponent: '15U OFFSEASON BASEBALL - WILLIAMS',
    homeAway: 'home',
    tournamentId: BRAWL_ID,
  },
  {
    id: 'bb-den',
    date: '2026-09-27',
    opponent: 'Den Guys 15u',
    homeAway: 'home',
    tournamentId: BRAWL_ID,
    result: 'L 0-7',
  },
];

const octGames: ScheduleGame[] = [
  {
    id: 'oct-west',
    date: '2026-10-10',
    time: '8:00 AM',
    opponent: '15U OFFSEASON BASEBALL - WESTBROOKS',
    homeAway: 'home',
    tournamentId: OCT_ID,
    result: 'L 15-3',
  },
  {
    id: 'oct-scorp',
    date: '2026-10-10',
    time: '12:40 PM',
    opponent: 'Scorpions Team Easton 2030 Black',
    homeAway: 'away',
    tournamentId: OCT_ID,
    result: 'T 2-2',
  },
  {
    id: 'oct-amp',
    date: '2026-10-11',
    time: '12:40 PM',
    opponent: 'AMP Academy - 15u',
    homeAway: 'home',
    tournamentId: OCT_ID,
    venue: 'Premier Baseball of Texas',
    field: 'Field 7',
    diamondkastUrl: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597473',
    result: null,
  },
  {
    id: 'oct-canes',
    date: '2026-10-11',
    time: '5:20 PM',
    opponent: 'Canes Houston - 15U',
    homeAway: 'home',
    tournamentId: OCT_ID,
    venue: 'Premier Baseball of Texas',
    field: 'Field 7',
    diamondkastUrl: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597476',
    result: null,
  },
];

const schedule: BaseballSchedule = {
  tournaments: [
    { id: BRAWL_ID, name: 'Backyard Brawl', dates: 'Sep 26-27', eventId: '140434' },
    { id: OCT_ID, name: 'Octoberfest', dates: 'Oct 10-11', eventId: OCT_EVENT },
  ],
  games: [...brawlGames, ...octGames],
};

const d1SeptemberOnly: ApiGame[] = [
  { id: 1, date: '2026-09-26', opponent: 'TSB', result: 'W 7-5' },
  { id: 2, date: '2026-09-26', opponent: 'Offseason Baseball', result: 'L 3-4' },
  { id: 3, date: '2026-09-27', opponent: 'Den Guys 15u', result: 'L 0-7' },
];

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

const canesSf: LiveBracketGame = {
  game_number: 42,
  round: 'Semifinal',
  date: '2026-10-11',
  time: '5:20 PM',
  field: 'PLAY BY PLAY | Field 7',
  venue: 'Premier Baseball of Texas',
  pg_game_id: '1597476',
  home: { name: '4:13 Baseball', score: null },
  away: { name: 'Canes Houston - 15U', score: null },
  winner: null,
};

const bracketSnapshot: LiveBracketSnapshot = {
  schemaVersion: 1,
  event_id: OCT_EVENT,
  tiers: [{ tier: 'Bronze Bracket', games: [ampBracketFinal, canesSf] }],
  game_count: 2,
  scraped_at: '2026-10-11T20:00:00.000Z',
  source: 'Perfect Game',
};

describe('computeSeasonRecord', () => {
  it('merges D1 September box scores, schedule October finals, and bracket AMP win', () => {
    const record = computeSeasonRecord(schedule, d1SeptemberOnly, bracketSnapshot);
    assert.ok(record);
    assert.equal(record.w, 2);
    assert.equal(record.l, 3);
    assert.equal(record.t, 1);
    assert.equal(record.last?.opponent, 'AMP Academy - 15u');
    assert.equal(record.last?.result, 'W 9-8');
  });

  it('counts a game in both D1 and schedule once (Den Guys QF)', () => {
    const record = computeSeasonRecord(schedule, d1SeptemberOnly, bracketSnapshot);
    assert.ok(record);
    assert.equal(record.l, 3);
  });

  it('ignores upcoming bracket rows (Canes semifinal)', () => {
    const record = computeSeasonRecord(schedule, d1SeptemberOnly, bracketSnapshot);
    assert.ok(record);
    assert.notEqual(record.last?.opponent, 'Canes Houston - 15U');
  });

  it('does not let partial D1 alone shrink the record (Sep-only D1 vs full schedule)', () => {
    const d1Only = d1SeptemberOnly;
    const fromD1GamesAlone = { w: 1, l: 2, t: 0 };
    let w = 0;
    let l = 0;
    let t = 0;
    for (const g of d1Only) {
      const c = g.result.trim().charAt(0);
      if (c === 'W') w++;
      else if (c === 'L') l++;
      else if (c === 'T') t++;
    }
    assert.deepEqual({ w, l, t }, fromD1GamesAlone);

    const merged = computeSeasonRecord(schedule, d1Only, bracketSnapshot);
    assert.ok(merged);
    assert.notDeepEqual(
      { w: merged.w, l: merged.l, t: merged.t },
      fromD1GamesAlone,
    );
  });
});
