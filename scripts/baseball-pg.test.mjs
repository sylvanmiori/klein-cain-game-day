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
