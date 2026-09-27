# 4:13 Baseball D1 provisioning

The 4:13 Baseball box-score API (`POST /api/baseball/boxscore`,
`POST /api/baseball/boxscore/confirm`, `GET /api/baseball/games/:id`,
`PUT /api/baseball/games/:id/lines`, `DELETE /api/baseball/games/:id`,
`GET /api/baseball/stats` in `cloudflare/worker.mjs`) reads and writes a
Cloudflare D1 database through the `BASEBALL_STATS` binding.

**Status (2026-09-26):** D1 database `413baseball-stats` (id
`8885adde-6929-40f8-906d-bef5479729cf`) is created, bound in
`cloudflare/wrangler.jsonc`, schema applied, and the 15-player roster seeded.
Steps a–d below are historical reference. The remaining one-time step is
**e) Set the upload password** — until `BOXSCORE_PASSWORD` exists on the
`gameday-report` Worker, Analyze returns `503 {"error":"uploads not configured"}`.

Historical provisioning steps (already done):

## a) Create the D1 database

Dashboard: Cloudflare dashboard → Workers & Pages → D1 → **Create** → name it
exactly `413baseball-stats`.

Or with the CLI (from the repo root):

```bash
wrangler d1 create 413baseball-stats
```

Copy the **database ID** from the output (or from the database's dashboard
page). You will need it in the next step.

## b) Bind it in wrangler.jsonc

Open `cloudflare/wrangler.jsonc` and ensure the live `d1_databases` block
matches (already bound as of 2026-09-26):

```jsonc
"d1_databases": [
  {
    "binding": "BASEBALL_STATS",
    "database_name": "413baseball-stats",
    "database_id": "8885adde-6929-40f8-906d-bef5479729cf"
  }
],
```

The live binding uses database_id `8885adde-6929-40f8-906d-bef5479729cf`.
Do not replace it with a placeholder — a fake ID breaks every deploy.

## c) Apply the schema

```bash
wrangler d1 execute 413baseball-stats --remote --file=cloudflare/baseball-schema.sql
```

This creates `players`, `games`, `batting_lines`, and `pitching_lines`
(plus indexes). It is safe to re-run (`CREATE TABLE IF NOT EXISTS`).

Schema notes beyond the table definitions:

- `batting_lines` carries `"1b"` (singles) and `e` (fielding errors, from the
  GameChanger "E:" line under the batting table) alongside the original
  columns. `"1b"` is quoted like `"2b"`/`"3b"` because bare identifiers
  starting with a digit are not valid SQL column names.
- `pitching_lines` carries `pitches` and `strikes` (from GameChanger's
  "Pitches-Strikes: Name 87-46" line).
- `players.jersey_number` is filled in from box-score screenshots (the PG
  roster has none) and is the primary key the parser uses to match
  GameChanger's truncated player names ("H Hoeg...r #14") to roster players.

## d) Seed the roster

```bash
node scripts/baseball-seed.mjs > /tmp/seed.sql
wrangler d1 execute 413baseball-stats --remote --file=/tmp/seed.sql
```

(`npm run baseball:seed` prints the same SQL.) This inserts the 15 roster
players. Re-running is harmless (`INSERT OR IGNORE`). The confirm endpoint
also grows the roster automatically: any player name it has never seen is
inserted with position `UT`, and the API response lists them under
`new_players`.

## e) Set the upload password

Box-score uploads are gated by a shared password compared with the
`BOXSCORE_PASSWORD` secret. Set it (one word, your choice). Dashboard route
(works even without local wrangler login):

- Cloudflare Dashboard → Workers & Pages → `gameday-report` →
  Settings → **Variables and Secrets** → Add variable:
  name `BOXSCORE_PASSWORD`, value the one word you chose.

or via CLI:

```bash
wrangler secret put BOXSCORE_PASSWORD
```

Until this secret exists, `POST /api/baseball/boxscore` and
`POST /api/baseball/boxscore/confirm` return
`503 {"error":"uploads not configured"}`, and the `/baseball/submit` page
says uploads are not enabled yet. A wrong password returns `401`. The
password is compared with a timing-safe check and is never logged.

## f) Deploy

Pushes to `main` auto-deploy via Workers Builds, so the D1 binding, the
Workers AI binding (`AI`, used by the box-score screenshot parser), and the
secret go live on the next push. Verify after deploy:

```bash
curl https://413baseball.gameday.report/api/baseball/stats
```

You should get `{"players":[...15 roster players...],"games":[],"batting":[],"pitching":[]}`.

## DNS / custom domain

The `413baseball.gameday.report` custom domain is declared in the `routes`
array in `cloudflare/wrangler.jsonc`. Because `gameday.report` is already on
Cloudflare, the subdomain is provisioned automatically on deploy. If it does
not attach, add it manually under Workers & Pages → `gameday-report` →
Settings → Domains → Add custom domain.

## API quick reference

- `POST /api/baseball/boxscore` — multipart form: `password`, one or two
  screenshot files as `images[]` (batting view and/or pitching view for ONE
  game; the legacy single `image` field still works), 10 MB per image, 4 max,
  optional `game_id`, `game_date`, `opponent`, `tournament`, `venue`.
  Prefer JPEG/PNG/WebP. Raw `image/heic` / `image/heif` (or `.heic`/`.heif`
  filenames) return `415` with `HEIC must be converted; update the app` —
  the `/submit` UI converts HEIC→JPEG client-side before upload.
  The vision prompt is GameChanger-aware: it reads the header (date, teams,
  line score) to derive `our_score`/`opp_score`/`result` ("W 10-9" style),
  splits hits via the TB line (TB = 1B + 2·2B + 3·3B + 4·HR), reads the
  extra 2B/3B/HBP/SF/SB/CS/E and Pitches-Strikes/Batters-Faced lines, and
  matches players by jersey number first, fuzzy last name second. Returns the
  extracted `{game, batting, pitching}` plus `uncertain` (low-confidence
  player matches with reasons) and `already_exists` (true when D1 already has
  lines for that `game_id`). Vision model is
  `@cf/meta/llama-4-scout-17b-16e-instruct` (Codex `0f3cb19`; replaced Llama
  3.2 after zero-filled batting trials — do not fatten the prompt instead).
  Call uses `max_tokens: 4096` (Workers AI default is 256, which truncates
  dense box-score JSON mid-object). On Meta license gate 5016 the worker
  submits `{prompt:'agree'}` once and retries. After parse,
  `cloudflare/boxscore-filter.mjs` strips roster-dump filler. AI failure →
  `502` with `message`; parse failures include a short `model_snippet=` of
  the raw model text (no secrets) for debugging. Full pipeline:
  [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md).
- `POST /api/baseball/boxscore/confirm` — JSON `{password, game:{id|null,
  date, opponent, tournament, venue, result}, batting:[...], pitching:[...]}`.
  Replacement semantics: existing lines for the game are deleted and
  re-inserted, so re-uploads are idempotent; replacing also refreshes the
  game's header fields (date, opponent, result…). Jersey numbers from the
  lines are stored on the player rows. Unknown player names are added to the
  roster and returned in `new_players`. Returns
  `{ok:true, game_id, replaced, new_players}`.
- `GET /api/baseball/games/:id` — public. Returns `{game, batting, pitching}`
  with the per-game lines (player names, jerseys, positions included) for the
  edit UI and the public `/baseball/box-score?game=` page.
- `PUT /api/baseball/games/:id/lines` — password-gated. JSON
  `{password, game:{...}, batting:[...], pitching:[...]}`. Replaces ALL lines
  for the game through the same write path as confirm; the `game` object is
  optional and updates the header fields it includes. 404 when the game does
  not exist. Returns `{ok:true, game_id, replaced:true, new_players}`.
- `DELETE /api/baseball/games/:id` — password-gated. JSON `{password}`.
  Deletes the game's lines first, then the game row. Returns
  `{ok:true, deleted_game_id}`.
- `GET /api/baseball/stats` — per-player batting (`1b`, `e` included;
  `avg/obp/slg/ops`, rounded to 3 decimals, null on 0 AB) and pitching
  (`pitches`, `strikes` included; `era` = ER×9/IP, `whip`), aggregated in
  thirds of an inning so IP like 5.2 is handled correctly. Also returns the
  `players` (with `jersey_number`) and `games` lists (Home/Schedule
  `LiveGameResult` and the Stats “Game Box Scores” list consume this).

Password checks on all write endpoints go through one helper with a
best-effort throttle: more than 10 failed attempts from one IP in 5 minutes
→ `429`. The throttle counter is in-memory per isolate (not shared across
Workers instances, resets on cold start), so it blunts casual guessing, not
a determined distributed attack. Passwords are never logged.
