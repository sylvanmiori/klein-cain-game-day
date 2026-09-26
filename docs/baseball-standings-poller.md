# 4:13 Baseball Perfect Game pool-standings poller

Server-side pool-standings refresh for 413baseball.gameday.report. No agent in
the loop for normal weekend refreshes: a Worker cron fetches the tournament's
Perfect Game pool-standings page, normalizes it into a snapshot, stores it in
KV, and the site reads only the snapshot.

## Architecture

```
Worker cron (*/15 * * * *) ──fetch──> perfectgame.org/events/TournamentPoolStandings.aspx
        │ parse + normalize (cloudflare/baseball-standings.mjs)
        ▼
KV (SCORES namespace): baseball:standings:<event_id>   ← last-good snapshot
                       baseball:standings:<event_id>:ingest ← telemetry
        ▲
GET /api/baseball/standings ──reads──┘
        ▲
Standings page <StandingsLive> ──fetches──┘ (falls back to schedule.json pool_standings)
```

The Next.js request path never scrapes Perfect Game. The page shows
"Updated … · Source: Perfect Game" when rendering live data.

## Cron schedule

`cloudflare/wrangler.jsonc` triggers: `["* * * * *", "*/15 * * * *"]`.
`scheduled()` in `cloudflare/worker.mjs` dispatches on `controller.cron`:
`*/15 * * * *` runs `pollBaseballBracket()` **and**
`pollBaseballPoolStandings()` (each in its own try/catch so one failure does
not skip the other; any failures are rethrown, AggregateError if both fail).
The every-minute cron keeps running the football score ingest untouched.

Inside the poll, cadence is gated by Chicago time (same as the bracket poller):

- **Sat/Sun 7:00am–11:00pm CT**: every 15-minute tick (~10–15 min cadence).
- **Off-hours / overnight / weekdays**: only the `:00` tick each hour.
- **No tournament covering the weekend** (per the bundled
  `content/baseball/schedule.json`): silent skip, no fetch, no error.

## KV keys (existing SCORES namespace)

No new KV namespace was provisioned; keys are isolated by prefix:

- `baseball:standings:<event_id>` — the snapshot JSON (see schema below).
- `baseball:standings:<event_id>:ingest` — telemetry:
  `{ lastAttempt, lastSuccess, lastError, consecutiveFailures }`.

**Last-good semantics.** The snapshot key is written ONLY after a successful
fetch + parse. A failed fetch, an unparseable page, or a page with zero pools /
teams records telemetry and rethrows (so the invocation shows as failed in the
Cloudflare dashboard) but never overwrites the previous good snapshot.
Nothing is ever invented: no seeds, W/L/T, or teams beyond the page.

## Snapshot schema

```json
{
  "schemaVersion": 1,
  "event_id": "140434",
  "tournament": "2026 15U PG Backyard Brawl @ Premier",
  "standings_url": "https://www.perfectgame.org/events/TournamentPoolStandings.aspx?event=140434",
  "pools": [
    {
      "pool": "Pool A",
      "teams": [
        {
          "seed": 8,
          "name": "4:13 Baseball",
          "team_url": "https://www.perfectgame.org/events/Tournaments/Teams/Default.aspx?team=1173262",
          "state": "TX",
          "pct": 0,
          "w": 0,
          "l": 0,
          "t": 0,
          "ra": 0,
          "rs": 0
        }
      ]
    }
  ],
  "team_record": { "pool": "Pool A", "seed": 8, "w": 0, "l": 0, "t": 0, "pct": 0, "ra": 0, "rs": 0 },
  "scraped_at": "2026-09-26T21:00:00.000Z",
  "source": "Perfect Game"
}
```

Parsing notes (`cloudflare/baseball-standings.mjs`, shared with
`scripts/baseball-pg.mjs` so the Thursday scraper and Worker stay in sync):

- Rows are matched **only** via ASP.NET repeater control ids
  (`rptrPools_rptrPoolStandings_{pool}_hlTeam_{n}`, `lblRownum_{n}`,
  `lblPoolTitle_{pool}`). A bare `<tr>…hlTeam…</tr>` scan is unsafe: the same
  page embeds DiamondKast scoreboard HTML that can corrupt cells
  (e.g. `state="Game Recap"`).
- Following cells after the team link: state, pct, W, L, T, RA, RS.
- `team_record` is the row whose name matches the schedule team
  (`4:13 Baseball`), or null when absent.

## API

`GET /api/baseball/standings` → the snapshot plus `updated_at` (= `scraped_at`)
and `source: "Perfect Game"`. Responses:

- `200` — snapshot JSON.
- `404 { error: "No tournament this weekend" }` — nothing to poll.
- `404 { error: "Standings not posted yet", event_id }` — poller has not stored
  a snapshot; the site falls back to build-time `pool_standings` on
  `content/baseball/schedule.json`.
- `503` — KV temporarily unavailable.

## Failure behavior

| Situation | What happens |
|---|---|
| PG fetch fails / page unparseable / zero teams | Telemetry records the failure; last-good snapshot stays; cron invocation throws so the dashboard shows it |
| No tournament this weekend | Silent skip (not a failure) |
| KV read fails on the API path | 503, page falls back to build-time pool_standings |
| Standings not posted yet on PG | Poller keeps last-good (or nothing); page shows "Pool standings not posted yet" |

## Relationship to the Thursday schedule scraper

`.github/workflows/baseball-schedule.yml` still runs
`npm run baseball:schedule`, which captures `pool_standings` into
`content/baseball/schedule.json` via the same shared parser. That embedded
table is the **build-time fallback** for `<StandingsLive>` when the KV
snapshot is absent.

## Out of scope (unchanged)

D1 `413baseball-stats` provisioning, the upload password, social posts,
DiamondKast (never touched), and all football behavior.
