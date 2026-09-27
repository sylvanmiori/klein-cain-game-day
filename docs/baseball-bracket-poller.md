# 4:13 Baseball Perfect Game bracket poller

Server-side bracket refresh for 413baseball.gameday.report. No agent in the
loop for normal weekend refreshes: a Worker cron fetches the tournament's
Perfect Game bracket page, normalizes it into a snapshot, stores it in KV,
and the site reads only the snapshot.

## Architecture

```
Worker cron (*/15 * * * *) ──fetch──> perfectgame.org/events/Brackets.aspx
        │ parse + normalize (cloudflare/baseball-bracket.mjs)
        ▼
KV (SCORES namespace): baseball:bracket:<event_id>   ← last-good snapshot
                       baseball:bracket:<event_id>:ingest ← telemetry
        ▲
GET /api/baseball/bracket ──reads──┘
        ▲
Schedule page <BracketLive> ──fetches──┘ (falls back to build-time bracket.json)
```

The Next.js request path never scrapes Perfect Game. The page shows
"Updated … · Source: Perfect Game" when rendering live data. Snapshots live in
**KV only** (not R2). When Perfect Game replaces `Seed #N` placeholders with
real team names and/or fills scores, the next successful poll updates the
Schedule bracket **without a deploy**.

`<BracketLive>` is a client fetch: SSR / first paint may briefly show
build-time `content/baseball/bracket.json` until the client hydrates from
`GET /api/baseball/bracket`.

## Cron schedule

`cloudflare/wrangler.jsonc` triggers: `["* * * * *", "*/15 * * * *"]`.
`scheduled()` in `cloudflare/worker.mjs` dispatches on `controller.cron`:
`*/15 * * * *` runs `pollBaseballBracket()` **and**
`pollBaseballPoolStandings()` (each in its own try/catch so one failure does
not skip the other; any failures are rethrown, AggregateError if both fail).
The every-minute cron (`* * * * *`) keeps running the football score ingest
only — baseball does not touch that path.

Inside the poll, cadence is gated by Chicago time:

- **Sat/Sun 7:00am–11:00pm CT**: every 15-minute tick (~10–15 min cadence).
- **Off-hours / overnight / weekdays**: only the `:00` tick each hour.
- **No tournament covering the weekend** (per the bundled
  `content/baseball/schedule.json`): silent skip, no fetch, no error.

## KV keys (existing SCORES namespace, id 230ad4e9643a45b7b9e7a9a88ca3db6a)

No new KV namespace was provisioned; keys are isolated by prefix:

- `baseball:bracket:<event_id>` — the snapshot JSON (see schema below).
- `baseball:bracket:<event_id>:ingest` — telemetry:
  `{ lastAttempt, lastSuccess, lastError, consecutiveFailures }`.

**Last-good semantics.** The snapshot key is written ONLY after a successful
fetch + parse. A failed fetch, an unparseable page, or a page with zero games
records telemetry and rethrows (so the invocation shows as failed in the
Cloudflare dashboard) but never overwrites the previous good snapshot.
Nothing is ever invented: no scores, seeds, teams, or games beyond the page.

## Snapshot schema

```json
{
  "schemaVersion": 1,
  "event_id": "140434",
  "tournament": "2026 15U PG Backyard Brawl @ Premier",
  "bracket_url": "https://www.perfectgame.org/events/Brackets.aspx?event=140434",
  "tiers": [
    {
      "tier": "Gold Bracket",
      "games": [
        {
          "game_number": 20,
          "round": "Quarterfinal",
          "date": "2026-09-27",
          "time": "8:00 AM",
          "field": "Field 7",
          "venue": "Premier Baseball of Texas",
          "home": { "seed": "#4", "name": "Seed #4", "score": null },
          "away": { "seed": "#5", "name": "Seed #5", "score": null },
          "winner": null
        }
      ]
    }
  ],
  "game_count": 15,
  "scraped_at": "2026-09-26T19:00:00.000Z",
  "source": "Perfect Game"
}
```

Parsing notes (`cloudflare/baseball-bracket.mjs`, shared with the
`scripts/baseball-bracket.mjs` one-shot scraper so both read the page
identically):

- Team boxes pair with game cells by slot number (`SeedPos{N}` /
  `GamePos{N}`); table row order is not reliable.
- Round labels come from the page's own "Winner of Game #N" feeder
  references (depth 0 = Championship).
- `winner` is derived only when the page shows both scores and they differ;
  otherwise null. Seeds render as PG shows them (`Seed #N` placeholders until
  pool play fills real team names). Do not invent names or scores ahead of PG.

## API

`GET /api/baseball/bracket` → the snapshot plus `updated_at` (= `scraped_at`)
and `source: "Perfect Game"`. Responses:

- `200` — snapshot JSON.
- `404 { error: "No tournament this weekend" }` — nothing to poll.
- `404 { error: "Bracket not posted yet", event_id }` — poller has not stored
  a snapshot; the site falls back to build-time `content/baseball/bracket.json`.
- `503` — KV temporarily unavailable.

## Failure behavior

| Situation | What happens |
|---|---|
| PG fetch fails / page unparseable / zero games | Telemetry records the failure; last-good snapshot stays; cron invocation throws so the dashboard shows it |
| No tournament this weekend | Silent skip (not a failure) |
| KV read fails on the API path | 503, page falls back to build-time bracket.json |
| Bracket not posted yet on PG | Poller keeps last-good (or nothing); page shows "Bracket not posted yet" |

## Relationship to the GitHub Action scraper

`.github/workflows/baseball-bracket.yml` still runs the one-shot
`npm run baseball:bracket` (hourly Sat 11pm CT → Sun 12pm CT) and commits
`content/baseball/bracket.json`. That file is **build-time fallback only** for
`<BracketLive>` when the KV snapshot is absent. The live path is Worker → KV →
`GET /api/baseball/bracket`. Both scrapers use the same parser.

Point-in-time example (Sat Sep 26, 2026 evening, event 140434): bracket
structure was live (~15 games) with `Seed #N` placeholders only. Treat that as
a mechanism check, not forever truth — the next poll picks up whatever PG
publishes.

## Weekend ops (bracket)

Bracket seeds/scores auto-update on `/schedule` once PG publishes them; no
deploy and no agent babysitting. Home "This Weekend" and the Schedule
**tournament game list** still come from build-time `schedule.json` (see
[Weekend ops / Sunday readiness](baseball-site.md#weekend-ops--sunday-readiness)).

## Out of scope (unchanged)

D1 `413baseball-stats` provisioning, social posts, DiamondKast (never
touched), football cron / score ingest, and box-score upload (separate path;
see [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md)).
