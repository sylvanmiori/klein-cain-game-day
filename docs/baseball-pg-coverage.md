# Perfect Game coverage — 4:13 Baseball scraper

What `scripts/baseball-pg.mjs` (`npm run baseball:schedule`) captures from
Perfect Game, what it deliberately does not touch, and how the Thursday and
Saturday jobs consume the dataset. Verified against the live site 2026-09-26.

## Paywall boundary (non-negotiable)

Perfect Game player stats are DiamondKast-paywalled. The scraper never
touches paywalled content and never attempts to bypass a login or paywall:

- DiamondKast game pages (`/DiamondKast/Game.aspx?gameid=...`) are **linked,
  never fetched**. The public scoreboard tiles on the event home page (team
  names, runs, game status) are public page content and are captured; the
  paywalled game-detail pages behind the "Game Recap" links are not.
- Individual player stat lines on PG (batting/pitching) are paywalled and
  are not captured. The roster table itself is public and is captured.
- Player profile pages (`/Players/Playerprofile.aspx?ID=...`) are linked
  from the roster (`player_url`) but not crawled.

## Pages captured

### 1. Team page (core, fatal on failure)

`https://www.perfectgame.org/PGBA/Team/default.aspx?orgid=69753&orgteamid=297202&Year=2027`

| Field | Source |
|---|---|
| team name, hometown, age division | `lblOrgTeamName`, `lblTeamHomeTown`, `lblAgeDivision` |
| organization name + URL | `hlOrganizationName` |
| membership year | `lblAssociationYear` (e.g. `2026-2027`) |
| full roster table: name, profile URL, pos, B/T, grad year, height, weight, HS, hometown, rank, commitment | `FULL ROSTER` RadGrid (`rgRow`/`rgAltRow`); columns mapped by header label, not position |
| TEAM SCHEDULE: every tournament (name, dates, start/end, city, venue, event id, event URL, bracket URL) and every game (date, time, opponent, opponent record, opponent URL, home/away, pool, field, venue, DiamondKast URL) | schedule rows + `hfTournamentID`/`hfStartDate`/`hfEndDate` hidden fields |

PG shows **no team record or ranking** on the team page, so `team.record`
and `team.ranking` are always `null` rather than invented.

### 2. Tournament event page (best-effort per tournament)

`/events/Default.aspx?event={eventId}` (followed from the team page's
`hlEvent` link)

| Field | Source |
|---|---|
| event name, dates | `<title>`, `lblDatesNew` |
| venue, city, street address | `lblEventLocaGeneral` (+ its Google Maps link) |
| age divisions offered | `rptDivisions` buttons |
| pool standings page URL | `hlTournamentPoolStandings` link |
| **event scoreboard**: every game tile — visitor/home, runs, status (`Final`, `Top N`/`Bot N`, or null when scheduled), date/time, venue/field, DiamondKast game id | `ucDiamondKast_dlScoreBoard` repeater (`hlDiamondKastGames_{n}`) |

Schedule games are joined to scoreboard rows by DiamondKast game id, so
once a game is final the team's game gets `result` (`"W 5-1"` format, from
4:13's perspective), `result_status`, `runs_for`, `runs_against`.
In-progress games get a status but no `result`; scheduled games keep nulls.
A game is never assigned a result unless one side's name matches 4:13.

### 3. Pool standings page (best-effort per tournament)

`/events/TournamentPoolStandings.aspx?event={eventId}` (linked from the
event page header, so this is a plain GET — the team page's own Standings
tab is `__doPostBack`-only, see below)

| Field | Source |
|---|---|
| every pool with every team: seed, name, team URL, state, pct, W, L, T, runs allowed, runs scored | `lblPoolTitle_{p}` + `rptrPoolStandings` rows (columns: seed, team, ST, PCT, W, L, T, RA, RS) |
| 4:13's record in the event | the pool row whose team name matches 4:13 |

### 4. Bracket page (Saturday job)

`/events/Brackets.aspx?event={eventId}` is fetched by
`scripts/baseball-bracket.mjs`, not by the schedule run — brackets usually
post Saturday night. See `docs/baseball-brackets.md` for the page structure.
On `BRACKET_FOUND=true` the bracket games are merged into the latest dated
snapshot under that tournament's `event_id`.

## Unavailable / not captured

- **DiamondKast game detail pages** — paywalled; linked only.
- **PG player stat lines** (batting/pitching) — paywalled; never fetched.
- **Team page Standings / Roster / Results tabs** — these are
  `__doPostBack` links with no plain GET URL, so they are not fetchable.
  The roster *table* and pool standings are still captured because they are
  server-rendered on the team page and on the event page's
  `TournamentPoolStandings.aspx` page respectively.
- **Bracket results/scores** — bracket team boxes render score spans, but
  the bracket script only extracts matchups/dates/times/fields; final
  bracket scores are not parsed (the public scoreboard covers game scores).

## Snapshot scheme

Each successful schedule run writes
`content/baseball/pg-snapshots/YYYY-MM-DD.json` (date in America/Chicago),
containing the **full capture**: team metadata, roster, every tournament
with its games (results joined), event metadata, pool standings, 4:13's
event record, the event scoreboard, and `capture_notes` (non-fatal
per-page failures, recorded honestly instead of faked). Parsed data only —
no HTML blobs; a typical snapshot is ~15-30 KB. Same-day reruns overwrite
the file. The Saturday bracket job merges found bracket games into the
latest snapshot.

## How the jobs consume the dataset

- **Thursday ~6pm CT** (`baseball-schedule.yml`): `npm run baseball:schedule`
  rewrites `content/baseball/schedule.json` and the dated snapshot, then
  commits both (snapshots staged via `git add content/baseball/pg-snapshots`;
  commit only when staged content changed, same pattern as the schedule
  file). The site's `components/baseball/data.ts` loader reads
  `schedule.json`; its shape is backward-compatible (fields only added).
- **Saturday 11pm–Sunday noon CT** (`baseball-bracket.yml`):
  `npm run baseball:bracket` reads `schedule.json` for the weekend
  tournament's `event_id`/`bracket_url`, writes `bracket.json` or
  `bracket-missing.json`, prints `BRACKET_FOUND`, and merges found brackets
  into the latest snapshot.
- On any core failure the schedule script writes
  `content/baseball/schedule-error.json` and exits non-zero, so the last
  verified schedule is kept; the workflow commits the error file for
  visibility. Auxiliary page failures (event/standings) are non-fatal and
  appear in `capture_notes`.
