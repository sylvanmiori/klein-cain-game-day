# Game Day Report: Klein Cain

A football website with game previews, final scores, player notes and the season schedule. No subscription or email service is configured.

Start with the [project guide](docs/PROJECT-GUIDE.md) for accounts, costs, publishing, score updates, recovery and unfinished work.

## Status

The public site is https://kleincain.gameday.report/. https://gameday.report/ redirects to Klein Cain while it is the only school. GitHub Pages remains available as a migration fallback.

`/team` is the program page: schedule, season leaders, roster and links to every game report. Every game page is rendered from one JSON file in `content/editions/`. See [content/editions/TEMPLATE.md](content/editions/TEMPLATE.md) to add a game.

Weekly AI research is still disabled. The template is data-driven now, but generated facts, citations and costs are not yet controlled.

## Development

Use Node 24 or newer. Run `npm ci`, then `npm run dev`.

- `npm run validate` checks every edition file against the schedule and the editorial rules.
- `npm run promote` sets which edition is current, captures final scores and season statistics, and writes the recap (`node scripts/promote-edition.mjs --dry-run` to preview).
- `npm run refresh` updates records, the published pick, our rating and the forecast from public sources (`node scripts/refresh-facts.mjs --dry-run` to preview).
- `npm run test:score` tests the score parser, the Cloudflare Worker, the rating and the promotion rule.
- `npm run build:cloudflare` validates, builds root-relative static assets, then checks the built pages for stale opponents.
- `npm run deploy:cloudflare` deploys the website and score Worker.
