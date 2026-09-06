# Game Day Report: Klein Cain

A football site with a program page, one report per game, live scores and season statistics. No subscription or email service is configured.

Start with [AGENTS.md](AGENTS.md) when handing the repository to an AI developer, then read the [project guide](docs/PROJECT-GUIDE.md) for architecture, accounts, sources, automation, recovery and open work. Its **Traps worth knowing** section records the non-obvious failures already solved.

## Status

Live at https://kleincain.gameday.report/. https://gameday.report/ redirects there while Klein Cain is the only school. GitHub Pages remains a migration fallback.

`/` is the Klein Cain program page: the current game, the schedule, season leaders, roster and links to every report. Each game report is a subpage at `/games/week-<n>`, rendered from one JSON file in `content/editions/`.

The in-season data pipeline runs unattended in GitHub Actions. A scheduled workflow creates missing editions, promotes the current game, refreshes facts from public sources and writes a postgame recap. No language model is involved anywhere, and no AI API is configured.

Analysis is the exception: players to watch, keys and recruiting notes are never generated. Those sections stay empty unless a person writes them.

New schedule opponents require one setup pass: add their exact MaxPreps profile to `config/opponent-logos.json` and run `npm run logos`. Player portraits are refreshed manually with `npm run photos`. Neither asset import runs on the recurring facts workflow.

## Development

Node 24 is used in CI and recommended locally; the declared minimum is Node 22.13. Run `npm ci`, then `npm run dev`.

- `npm run editions` creates a starter edition for any scheduled game that lacks one.
- `npm run promote` sets which edition is current, captures final scores and season statistics, and writes the recap.
- `npm run postgame` is the manual alias for promotion, game statistics and Player of the Game capture.
- `npm run refresh` updates records, ranks, the published prediction, our rating, the forecast and our own results.
- `npm run photos` stores available Klein Cain roster portraits locally and maps them by player identity.
- `npm run logos` stores every configured opponent logo locally and updates its edition.
- `npm run validate` checks every edition against the schedule and the editorial rules.
- `npm run docs:check` verifies documented paths and npm commands still exist.
- `npm run test:score` tests the Worker, score parser, rating, recap, promotion rule and stats parser.
- `npm run build:cloudflare` validates, builds root-relative assets, then checks the built pages for stale opponents.
- `npm run deploy:cloudflare` deploys the site and score Worker.

`node scripts/refresh-facts.mjs --dry-run` and `node scripts/promote-edition.mjs --dry-run` report without writing. `PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a given day.
