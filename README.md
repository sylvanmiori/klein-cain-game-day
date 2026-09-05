# Game Day Report: Klein Cain

A football website with game previews, final scores, player notes and the season schedule. No subscription or email service is configured.

Start with the [project guide](docs/PROJECT-GUIDE.md) for accounts, costs, publishing, score updates, recovery and unfinished work.

## Status

The working site is https://sylvanmiori.github.io/klein-cain-game-day/. The new address will be https://kleincain.gameday.report/ after Cloudflare deployment is verified.

Weekly research is disabled until the edition template is fully data-driven. GitHub Pages remains available during the Cloudflare migration.

## Development

Use Node 24 or newer. Run `npm ci`, then `npm run dev`.

- `npm run test:score` tests the score parser and Cloudflare Worker.
- `npm run build:cloudflare` builds root-relative static assets.
- `npm run deploy:cloudflare` deploys the website and score Worker.
