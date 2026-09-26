# 4:13 Baseball D1 provisioning

The 4:13 Baseball box-score API (`POST /api/baseball/boxscore`,
`POST /api/baseball/boxscore/confirm`, `GET /api/baseball/stats` in
`cloudflare/worker.mjs`) reads and writes a Cloudflare D1 database through the
`BASEBALL_STATS` binding. Wrangler was not authenticated when this was built,
so the database itself still needs to be created. Do these steps once, in
order.

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

Open `cloudflare/wrangler.jsonc` and find the commented-out `d1_databases`
block. Paste the real database ID in place of
`REPLACE_WITH_D1_ID_AFTER_CREATION` and **uncomment the whole block**:

```jsonc
"d1_databases": [
  {
    "binding": "BASEBALL_STATS",
    "database_name": "413baseball-stats",
    "database_id": "<paste-the-real-id-here>"
  }
],
```

The block is commented out on purpose: a placeholder ID in a live
`d1_databases` block breaks every deploy, so it must stay commented until the
real ID is in.

## c) Apply the schema

```bash
wrangler d1 execute 413baseball-stats --file=cloudflare/baseball-schema.sql
```

This creates `players`, `games`, `batting_lines`, and `pitching_lines`
(plus indexes). It is safe to re-run (`CREATE TABLE IF NOT EXISTS`).

## d) Seed the roster

```bash
node scripts/baseball-seed.mjs > /tmp/seed.sql
wrangler d1 execute 413baseball-stats --file=/tmp/seed.sql
```

(`npm run baseball:seed` prints the same SQL.) This inserts the 15 roster
players. Re-running is harmless (`INSERT OR IGNORE`). The confirm endpoint
also grows the roster automatically: any player name it has never seen is
inserted with position `UT`, and the API response lists them under
`new_players`.

## e) Set the upload password

Box-score uploads are gated by a shared password compared with the
`BOXSCORE_PASSWORD` secret. Set it (one word, your choice):

```bash
wrangler secret put BOXSCORE_PASSWORD
```

Until this secret exists, `POST /api/baseball/boxscore` and
`POST /api/baseball/boxscore/confirm` return
`503 {"error":"uploads not configured"}`. A wrong password returns `401`.

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

- `POST /api/baseball/boxscore` — multipart form: `password`, `image`
  (screenshot file, 10 MB max), optional `game_id`, `game_date`, `opponent`,
  `tournament`, `venue`. Returns the vision model's extracted
  `{game, batting, pitching}` plus `already_exists` (true when D1 already has
  lines for that `game_id`). AI failure → `502`.
- `POST /api/baseball/boxscore/confirm` — JSON `{password, game:{id|null,
  date, opponent, tournament, venue, result}, batting:[...], pitching:[...]}`.
  Replacement semantics: existing lines for the game are deleted and
  re-inserted, so re-uploads are idempotent. Unknown player names are added to
  the roster and returned in `new_players`. Returns
  `{ok:true, game_id, replaced, new_players}`.
- `GET /api/baseball/stats` — per-player batting (`avg/obp/slg/ops`, rounded
  to 3 decimals, null on 0 AB) and pitching (`era` = ER×9/IP, `whip`),
  aggregated in thirds of an inning so IP like 5.2 is handled correctly. Also
  returns the `players` and `games` lists.
