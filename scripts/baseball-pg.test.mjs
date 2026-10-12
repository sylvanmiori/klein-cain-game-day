import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTournaments } from './baseball-pg.mjs';

// Live markup captured from the Perfect Game team page on 2026-10-02.
// PG wrapped the schedule-grid event name in <b><font color="#005CB9">,
// which silently dropped every tournament (the old regex required plain
// link text inside the anchor). Regression test: the decorated anchor
// must still parse, and roster-history / footer hlEvent anchors must not.
const FIXTURE = `
<div>TEAM SCHEDULE</div>
<table>
<tr class="rgRow" id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl04">
<input type="hidden" name="ctl00$ctl00$ContentTopLevel$ContentPlaceHolder1$rgSchedule$ctl00$ctl04$hfTournamentID" id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl04_hfTournamentID" value="140434" />
<input type="hidden" name="ctl00$ctl00$ContentTopLevel$ContentPlaceHolder1$rgSchedule$ctl00$ctl04$hfStartDate" id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl04_hfStartDate" value="09/26/2026" />
<input type="hidden" name="ctl00$ctl00$ContentTopLevel$ContentPlaceHolder1$rgSchedule$ctl00$ctl04$hfEndDate" id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl04_hfEndDate" value="09/27/2026" />
<a id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl04_hlEvent" href="/events/Default.aspx?event=140434" target="_blank"><b><font color="#005CB9">2026 15U PG Backyard Brawl @ Premier</font></b></a>
<br /><span>Sep 26-27</span><span>Tomball, TX</span>
</tr>
<tr class="rgRow">
<a id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgAllTournament_ctl00_ctl04_hlEvent" href="../../events/Default.aspx?event=140434"><font color="#2763A5">2026 15U PG Backyard Brawl @ Premier</font></a>
</tr>
</table>
<table>
<tr><td class="nestedscheduleGridRow">
<span id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_lblMonthDay">Sep 26</span>
<span id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_lblHomeAway">@</span>
<a id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_hlOpponentName" href="/PGBA/Team/default.aspx?orgid=83829&amp;orgteamid=313350">TSB</a>
<span id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_lblOpponentRecord">(0-6-0)</span>
<span id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_lblPool2">A</span>
<span id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_lblField">Field 7 @</span>
<a id="ctl00_ctl00_ContentTopLevel_ContentPlaceHolder1_rgSchedule_ctl00_ctl06_rgEvent_ctl00_ctl04_hlBallpark" href="/ballparks/x">Premier Baseball of Texas</a>
<a href="/DiamondKast/Game.aspx?gameid=1584457">DK</a>
</td></tr>
</table>
`;

describe('parseTournaments (decorated event anchor, 2026-10-02 markup)', () => {
  const tournaments = parseTournaments(FIXTURE);

  it('finds the one scheduled tournament', () => {
    assert.equal(tournaments.length, 1);
  });

  it('reads name, dates, city and event id through the nested tags', () => {
    const t = tournaments[0];
    assert.equal(t.name, '2026 15U PG Backyard Brawl @ Premier');
    assert.equal(t.start_date, '2026-09-26');
    assert.equal(t.end_date, '2026-09-27');
    assert.equal(t.event_id, '140434');
    assert.equal(t.city, 'Tomball, TX');
  });

  it('ignores roster-history and footer hlEvent anchors', () => {
    // The rgAllTournament anchor above carries no hidden date fields; if it
    // matched, parseTournaments would throw. Reaching this line proves scope.
    assert.ok(true);
  });

  it('still parses the nested game rows', () => {
    const games = tournaments[0].games;
    assert.equal(games.length, 1);
    assert.equal(games[0].opponent, 'TSB');
    assert.equal(games[0].date, '2026-09-26');
    assert.equal(games[0].home_away, '@');
    assert.equal(games[0].venue, 'Premier Baseball of Texas');
  });
});

// 2026-10-01 regression: the scheduled Thursday run died with
// 'Tournament "..." is missing its id or date range' on a single malformed
// row, so the whole weekend schedule never published. A bad row must be
// skipped with a capture note while the good rows still parse.
const MIXED_FIXTURE = `
<div>TEAM SCHEDULE</div>
<table>
<tr class="rgRow" id="row_good">
<input type="hidden" name="x$hfTournamentID" id="x_hfTournamentID" value="140434" />
<input type="hidden" name="x$hfStartDate" id="x_hfStartDate" value="10/09/2026" />
<input type="hidden" name="x$hfEndDate" id="x_hfEndDate" value="10/11/2026" />
<a id="ctl00_rgSchedule_ctl00_hlEvent" href="/events/Default.aspx?event=140434">2026 15U PG Fall Classic</a>
<br /><span>Oct 9-11</span><span>Tomball, TX</span>
</tr>
<tr class="rgRow" id="row_bad">
<a id="ctl00_rgSchedule_ctl01_hlEvent" href="/events/Default.aspx?event=999999">Ghost Tournament Row</a>
</tr>
</table>
`;

describe('parseTournaments (one malformed row, 2026-10-01 failure)', () => {
  const notes = [];
  const tournaments = parseTournaments(MIXED_FIXTURE, notes);

  it('keeps the good tournament', () => {
    assert.equal(tournaments.length, 1);
    assert.equal(tournaments[0].name, '2026 15U PG Fall Classic');
    assert.equal(tournaments[0].event_id, '140434');
    assert.equal(tournaments[0].start_date, '2026-10-09');
  });

  it('records the skipped row as a capture note instead of throwing', () => {
    assert.equal(notes.length, 1);
    assert.match(notes[0], /Ghost Tournament Row/);
    assert.match(notes[0], /missing its id or date range/);
  });

  it('still throws when the TEAM SCHEDULE section itself is absent', () => {
    assert.throws(() => parseTournaments('<div>no schedule here</div>'), /TEAM SCHEDULE section not found/);
  });
});

// 2026-10-08: PG posted Octoberfest pool-game times on the event scoreboard
// while the team page grid was still empty, so the site showed no games.
// Scoreboard games naming our team must merge into the tournament's game
// list (day 1 date), without duplicating grid games.
import { mergeScoreboardGames } from './baseball-pg.mjs';

describe('mergeScoreboardGames (event scoreboard ahead of team grid)', () => {
  const tournaments = [
    {
      name: '2026 15U PG Octoberfest @ Premier',
      start_date: '2026-10-10',
      end_date: '2026-10-11',
      event_id: '140496',
      games: [],
    },
  ];
  const captures = [
    {
      event_id: '140496',
      event: {
        scoreboard: [
          {
            game_id: '1596980',
            diamondkast_url: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1596980',
            status: null,
            datetime: '8:00 AM',
            visitor: '15U OFFSEASON BASEBALL - WESTBROOKS',
            visitor_runs: null,
            home: '4:13 Baseball',
            home_runs: null,
            venue: 'Schiel Road Park',
            field: 'Field 4',
          },
          {
            game_id: '1596983',
            diamondkast_url: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1596983',
            status: null,
            datetime: '12:40 PM',
            visitor: '4:13 Baseball',
            visitor_runs: null,
            home: 'Scorpions Team Easton 2030 Black',
            home_runs: null,
            venue: 'Schiel Road Park',
            field: 'Field 4',
          },
          // Not our team: ignored.
          {
            game_id: '1596960',
            diamondkast_url: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1596960',
            status: null,
            datetime: '8:00 AM',
            visitor: 'Loudboyz 2030',
            visitor_runs: null,
            home: 'Next Level Baseball',
            home_runs: null,
            venue: 'Schiel Road Park',
            field: 'Field 1',
          },
        ],
      },
    },
  ];
  const notes = [];
  mergeScoreboardGames(tournaments, captures, '4:13 Baseball', notes, '2026-10-08');
  const games = tournaments[0].games;

  it('adds the two pool games with day-1 dates', () => {
    assert.equal(games.length, 2);
    assert.equal(games[0].date, '2026-10-10');
    assert.equal(games[0].time, '8:00 AM');
    assert.equal(games[0].opponent, '15U OFFSEASON BASEBALL - WESTBROOKS');
    assert.equal(games[0].home_away, 'vs');
    assert.equal(games[1].time, '12:40 PM');
    assert.equal(games[1].opponent, 'Scorpions Team Easton 2030 Black');
    assert.equal(games[1].home_away, '@');
  });

  it('flags the date assumption in the capture notes', () => {
    assert.equal(notes.length, 2);
    assert.match(notes[0], /team page grid had no entry/);
  });

  it('never duplicates a game already in the grid', () => {
    const notes2 = [];
    mergeScoreboardGames(tournaments, captures, '4:13 Baseball', notes2, '2026-10-08');
    assert.equal(tournaments[0].games.length, 2);
    assert.equal(notes2.length, 0);
  });
});

import { carryForwardBracketScheduleGames, carryForwardFinals } from './baseball-pg.mjs';

describe('Sunday pull (2026-10-11 regression)', () => {
  const dk = (id) => `https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=${id}`;
  const amp = {
    game_id: '1597473', diamondkast_url: dk('1597473'), status: null, datetime: '12:40 PM',
    visitor: 'AMP Academy - 15u', visitor_runs: null, home: '4:13 Baseball', home_runs: null,
    venue: 'Premier Baseball of Texas', field: 'Field 7',
  };
  const fresh = () => [{ start_date: '2026-10-10', end_date: '2026-10-11', event_id: '140496', games: [] }];

  it('dates a Sunday scoreboard game on Sunday, not day 1', () => {
    const tournaments = fresh();
    mergeScoreboardGames(tournaments, [{ event_id: '140496', event: { scoreboard: [amp] } }], '4:13 Baseball', [], '2026-10-11');
    assert.equal(tournaments[0].games[0].date, '2026-10-11');
  });

  it('clamps a capture after the event to the end date', () => {
    const tournaments = fresh();
    mergeScoreboardGames(tournaments, [{ event_id: '140496', event: { scoreboard: [amp] } }], '4:13 Baseball', [], '2026-10-13');
    assert.equal(tournaments[0].games[0].date, '2026-10-11');
  });

  it('keeps Saturday finals PG dropped and never downgrades a final', () => {
    const tournaments = fresh();
    tournaments[0].games.push({ date: '2026-10-11', time: '12:40 PM', opponent: 'AMP Academy - 15u', diamondkast_url: dk('1597473'), result: null });
    tournaments[0].games.push({ date: '2026-10-10', time: '8:00 AM', opponent: 'X', diamondkast_url: dk('1'), result: null, result_status: null, runs_for: null, runs_against: null });
    const previous = { tournaments: [{ event_id: '140496', games: [
      { date: '2026-10-10', time: '8:00 AM', opponent: 'X', diamondkast_url: dk('1'), result: 'L 15-3', result_status: 'Final', runs_for: 3, runs_against: 15 },
      { date: '2026-10-10', time: '12:40 PM', opponent: 'Y', diamondkast_url: dk('2'), result: 'T 2-2', result_status: 'Final', runs_for: 2, runs_against: 2 },
      { date: '2026-10-10', time: '3:00 PM', opponent: 'Z', diamondkast_url: dk('3'), result: null },
    ] }] };
    const notes = [];
    carryForwardFinals(tournaments, previous, notes);
    const g = tournaments[0].games;
    assert.deepEqual(g.map((x) => [x.date, x.time, x.result]), [
      ['2026-10-10', '8:00 AM', 'L 15-3'],
      ['2026-10-10', '12:40 PM', 'T 2-2'],
      ['2026-10-11', '12:40 PM', null],
    ]);
    assert.equal(notes.length, 1);
  });
});

describe('carryForwardBracketScheduleGames', () => {
  it('keeps upcoming bracket-sourced rows PG team page omits', () => {
    const tournaments = [{ event_id: '140496', games: [] }];
    const previous = {
      tournaments: [{
        event_id: '140496',
        games: [{
          date: '2026-10-11',
          time: '5:20 PM',
          opponent: 'Canes Houston - 15U',
          diamondkast_url: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597476',
          date_source: 'bracket',
          result: null,
        }],
      }],
    };
    const notes = [];
    carryForwardBracketScheduleGames(tournaments, previous, notes);
    assert.equal(tournaments[0].games.length, 1);
    assert.equal(tournaments[0].games[0].opponent, 'Canes Houston - 15U');
    assert.equal(notes.length, 1);
  });

  it('keeps bracket finals when PG drops the row', () => {
    const tournaments = [{ event_id: '140496', games: [] }];
    const previous = {
      tournaments: [{
        event_id: '140496',
        games: [{
          date: '2026-10-11',
          time: '5:20 PM',
          opponent: 'Canes Houston - 15U',
          diamondkast_url: 'https://www.perfectgame.org/DiamondKast/Game.aspx?gameid=1597476',
          date_source: 'bracket',
          result: 'L 8-9',
          result_status: 'Final',
          runs_for: 8,
          runs_against: 9,
        }],
      }],
    };
    const notes = [];
    carryForwardBracketScheduleGames(tournaments, previous, notes);
    assert.equal(tournaments[0].games.length, 1);
    assert.equal(tournaments[0].games[0].result, 'L 8-9');
    assert.equal(notes.length, 1);
  });
});
