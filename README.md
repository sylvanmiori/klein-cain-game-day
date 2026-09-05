# Game Day Report: Klein Cain

A football website with game previews, final scores, player notes and the season schedule. No subscription or email service is configured.

Start with the [project guide](docs/PROJECT-GUIDE.md) for accounts, costs, publishing, score updates, recovery and unfinished work.

## Status

The public site is https://kleincain.gameday.report/. https://gameday.report/ redirects to Klein Cain while it is the only school. GitHub Pages remains available as a migration fallback.

Weekly research is disabled until the edition template is fully data-driven.

## Development

Use Node 24 or newer. Run `npm ci`, then `npm run dev`.

- `npm run test:score` tests the score parser and Cloudflare Worker.
- `npm run build:cloudflare` builds root-relative static assets.
- `npm run deploy:cloudflare` deploys the website and score Worker.
