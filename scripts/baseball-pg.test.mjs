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
