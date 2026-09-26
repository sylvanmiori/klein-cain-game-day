# Perfect Game tournament brackets — investigation notes

How to find, identify, and parse tournament bracket pages for the 4:13
Baseball subsite. Researched 2026-09-26 against the live Perfect Game site
(tournament "2026 15U PG Backyard Brawl @ Premier", event 140434).

## URL patterns (verified live)

Every tournament the team page lists links these event pages in the TEAM
SCHEDULE header row:

| Page            | Pattern                                                              |
| --------------- | -------------------------------------------------------------------- |
| Event home      | `https://www.perfectgame.org/events/Default.aspx?event={eventId}`    |
| Bracket         | `https://www.perfectgame.org/events/Brackets.aspx?event={eventId}`   |
| Event schedule  | `https://www.perfectgame.org/events/TournamentSchedule.aspx?event={eventId}&Date={MM/DD/YYYY}` |
| DiamondKast game| `https://www.perfectgame.org/DiamondKast/Game.aspx?gameid={gameId}`  |

Standings, Roster, and Results are `__doPostBack` links (server postback, no
plain GET URL), so they are not scrapable with a simple fetch.

## Identifying the current tournament's bracket page

`content/baseball/schedule.json` already resolves this for every tournament:

- `tournament.event_id` — the `{eventId}` above, read from the schedule row's
  `hlEvent` link (`/events/Default.aspx?event=NNNN`) and its
  `hfTournamentID` hidden field.
- `tournament.bracket_url` — the full bracket URL, read from the schedule
  row's "Bracket" link. `scripts/baseball-bracket.mjs` uses this directly and
  only falls back to `Brackets.aspx?event={event_id}` if the link is absent.

If Perfect Game ever changes the bracket path, the schedule scraper picks up
the new link automatically, because it reads the literal "Bracket" anchor.

## Bracket page structure (verified 2026-09-26)

`Brackets.aspx?event=140434` returns HTTP 200 and is fully server-rendered
(no JavaScript required). The page lists one bracket table per tier; the tier
label ("Gold Bracket", "Silver Bracket", "Bronze Bracket") appears as plain
text immediately before its `<table id="..._gvBracket">`. This event has no
per-division selector — the tiers are event-wide (single-division 15U event).

Each bracket game is described by three cell types inside the table:

- `td.HomeTeamBox` / `td.VisitorTeamBox` — one seed span
  (`..._lblHomeSeedPos{slot}_{i}`, e.g. `#4 `), one team link
  (`..._hlHomePos{slot}_{i}`, the team name, or `Winner of Game #N` before
  the feeders are decided), and one score span.
- `td.GameTopBox` (rowspan=2) — one span (`..._lblGamePos{slot}_{i}`) with
  `GM: 20 | 9/27 | 8:00 AM<br />Field 7 @ Premier Baseball of Texas`.
- The home box, visitor box, and game cell sharing the same `{slot}` number
  belong to the same game. Pair strictly by slot number, not by table row —
  the visual layout draws both bracket halves side by side, so row order is
  not a reliable pairing.

Example (Gold bracket, verified): slot 1 = GM 20, `#4 Seed #4` vs
`#5 Seed #5`, 9/27 8:00 AM, Field 7 @ Premier Baseball of Texas; the slot 4
visitor box reads `Winner of Game #20`.

## Extraction approach

1. Fetch the bracket URL with a browser User-Agent (same fetch helper as
   `scripts/baseball-pg.mjs`).
2. Split the page at each tier label preceding a `gvBracket` table.
3. For each table, collect team boxes and game cells keyed by slot number,
   then join them into games: `{round, date, time, matchup, field, venue}`.
4. `matchup` is `"home vs away"` using the team-link text with its seed
   prefix (e.g. `#4 Seed #4 vs #5 Seed #5`); when seeds are not yet set the
   text is literally `Winner of Game #N`.
5. Split `Field 7 @ Premier Baseball of Texas` on ` @ ` into field/venue.
   Game years come from the tournament's start date in schedule.json.
6. Round names come from the `Winner of Game #N` dependency graph: a game
   no other game references is the Championship; games feeding it are
   Semifinals; feeding those, Quarterfinals; then Round of 16, Round of 32.
7. "Bracket found" = the page contains at least one `gvBracket` table with
   at least one `GM:` game cell. Anything else (no tables, no games) means
   the bracket is not published yet and is reported as missing, not as an
   error.

## What could not be found

- There is no JSON/API endpoint for brackets that a plain fetch can reach;
  the page is ASP.NET WebForms markup, so regex parsing of the rendered
  table is the extraction method.
- There is no per-division bracket selector on the page for this event. If a
  future event runs multiple age divisions, the tier tables may mix
  divisions with no label in the markup; the script reports all games it
  finds and the tier each belongs to.

## If PG blocks non-browser requests

As of 2026-09-26 Perfect Game serves both the team page and the bracket page
to plain `node` fetch with a normal browser User-Agent (verified 200 on
both). `scripts/baseball-pg.mjs` retries with a second identifying
User-Agent set on later attempts. If PG starts blocking, the scripts degrade
as documented: the schedule script writes
`content/baseball/schedule-error.json` and exits non-zero; the bracket
script writes `content/baseball/bracket-missing.json` with the block as the
reason and prints `BRACKET_FOUND=false`.
