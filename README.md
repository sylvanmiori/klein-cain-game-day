# Game Day Report: Klein Cain

A football site with a program page, one report per game, live scores and season statistics. No subscription or email service is configured.

Start with the [project guide](docs/PROJECT-GUIDE.md) for architecture, accounts, sources, automation, recovery and open work. It also has a **Traps worth knowing** section that is worth reading before touching the data pipeline.

## Status

Live at https://kleincain.gameday.report/. https://gameday.report/ redirects there while Klein Cain is the only school. GitHub Pages remains a migration fallback.

`/` is the Klein Cain program page: the current game, the schedule, season leaders, roster and links to every report. Each game report is a subpage at `/games/week-<n>`, rendered from one JSON file in `content/editions/`.

The season runs unattended. A scheduled workflow creates missing editions, promotes the current game, refreshes facts from public sources and writes a postgame recap. No language model is involved anywhere, and no AI API is configured.

Analysis is the exception: players to watch, keys and recruiting notes are never generated. Those sections stay empty unless a person writes them.

## Development

Use Node 24 or newer. Run `npm ci`, then `npm run dev`.

- `npm run editions` creates a starter edition for any scheduled game that lacks one.
- `npm run promote` sets which edition is current, captures final scores and season statistics, and writes the recap.
- `npm run refresh` updates records, ranks, the published prediction, our rating, the forecast and our own results.
- `npm run validate` checks every edition against the schedule and the editorial rules.
- `npm run test:score` tests the Worker, score parser, rating, recap, promotion rule and stats parser.
- `npm run build:cloudflare` validates, builds root-relative assets, then checks the built pages for stale opponents.
- `npm run deploy:cloudflare` deploys the site and score Worker.

`node scripts/refresh-facts.mjs --dry-run` and `node scripts/promote-edition.mjs --dry-run` report without writing. `PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a given day.
