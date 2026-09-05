# Game Day Report project guide

Updated September 5, 2026. Keep this file current when accounts, hosting or automation change. Never store passwords, tokens or payment details here.

## Ownership and addresses

- Owner/persona: Sylvan Miori, SylvanMiori@gmail.com.
- Repository: https://github.com/sylvanmiori/klein-cain-game-day
- Existing site: https://sylvanmiori.github.io/klein-cain-game-day/
- Domain: `gameday.report`, purchased through Cloudflare September 5, 2026, confirmed by the owner.
- Public school address: https://kleincain.gameday.report/. The parent domain redirects here. No other schools are configured.

## Current status

Cloudflare deployment completed and was verified September 5, 2026. HTTPS, the parent-domain redirect, Week 1 and Week 3 routes, static assets, the score endpoint and the one-minute schedule all work. The existing Worker is connected to the GitHub repository, and its first automatic build from a GitHub push succeeded. GitHub Pages remains a fallback during migration.

The site is edition-driven. Every game page, including the home page, is rendered from one JSON file in `content/editions/` by a single component, `components/edition-page.tsx`. Adding a game means adding a file; no route, component or metadata change is needed. Page titles, share cards, matchup facts, players, recruiting rows, sources and the not-affiliated line all come from that file, so a new edition cannot inherit the previous opponent. Week 1, Week 2 and Week 3 exist today.

The weekly research schedule is still disabled. The edition template is now data-driven, but the generation and fact-checking workflow has not been designed or costed. Email delivery has been removed from the workflow. This is a website-only project for now.

## Costs

Checkout quoted $19.20 registration and $19.20 annual renewal. The domain requires annual renewal, not a one-time lifetime purchase. Check Cloudflare for the invoice, renewal date and auto-renew setting.

The code targets Cloudflare's free Worker and KV allowances. Those quotas are finite; review usage before adding schools or substantial traffic. Optional AI research would have separate API charges and is not enabled. No paid hosting plan or email service has been configured by this migration.

## Editions

One JSON file per game in `content/editions/`, named for its slug. `content/editions/TEMPLATE.md` carries the starting block and the rules. The shape is typed in `lib/edition.ts` (schema v2).

- `config/season-2026.json` is the authority on date, opponent, venue, home/away and kickoff. An edition that disagrees fails validation.
- Exactly one edition sets `"current": true`. That edition is the home page at `/` and is the only page with the live score card, the roster and the team photo. Every other edition is prerendered at `/games/week-<n>` by `app/games/[week]/page.tsx`.
- `config/publication.json` holds the school, wordmark and site-level sources. `config/program.json` holds program history and past seasons. The season record in the schedule card is derived from recorded results.
- Editions are their own archive. The retired `content/current-edition.json` and `content/archive/` were removed with schema v1.

To publish a new game: add the file, set `current` on the right edition, run `npm run validate`, `npm run build:cloudflare`, then push to `main`.

### Guardrails

Two scripts run automatically as part of `npm run build` and `npm run build:cloudflare`. Both exit non-zero and stop the build.

- `scripts/validate-editions.mjs` checks structure against the schedule and enforces the editorial rules: a preview player must carry a rating or say plainly that none is listed, a recruiting row must carry an https source, postgame leaders need a stat and a named box score, the disclaimer must name the opponent, and a preview must have content.
- `scripts/check-build.mjs` reads the built HTML and fails if a page's title, meta tags, heading or disclaimer names an opponent from a different week. Both checks account for schedule names that are prefixes of others, such as Klein and Klein Cain, or Magnolia and Magnolia West.

These are the reason weekly research can be enabled later without a person rereading every page. They check shape and staleness, not truth. Nothing verifies that a statistic is real, so generated facts still need a human or a cited source.

## Publishing

Cloudflare will serve the static site and run the score service. GitHub stores the source and can build and publish without this computer being on.

Configuration: `cloudflare/wrangler.jsonc`. The provisioned `gameday-report-scores` KV namespace stores scores, and its namespace ID is saved in that file so future deployments reuse it.

Automatic publishing uses Cloudflare Workers Builds connected directly to the GitHub repository. In the existing `gameday-report` Worker, open **Settings → Builds → Connect**, choose `sylvanmiori/klein-cain-game-day`, use `main` as the production branch and the repository root as the root directory. Set the build command to `npm run build:cloudflare` and the deploy command to `npm run deploy:cloudflare`. This connection avoids a long-lived Cloudflare token in GitHub.

After the connection is tested, pushes to `main` build and deploy without this computer. The old GitHub score schedule is disabled; its manual workflow remains only as a fallback for GitHub Pages.

Local commands use Node 24 or newer: `npm ci`, `npm run validate`, `npm run test:score`, `npm run build:cloudflare` (which validates and then checks the built pages), then `npm run deploy:cloudflare` with Cloudflare authorization.

## Scores

The Worker checks the schedule every minute. It fetches scores during scheduled game nights from 6 PM through 2 AM Central, including after midnight. It stops fetching once a final is saved. Visible browser pages check once per minute and stop at final.

The source is Dave Campbell's Texas Football's score endpoint. It is an external dependency, not a guaranteed feed or commercial data agreement. Confirm permitted use before commercial expansion. Polling cannot make a score fresher than the source, and KV replication can add delay.

The parser requires an unambiguous team/opponent match and valid scores. A source failure leaves the previous score intact. The checked-in game has a fallback in `public/live-score.json`.

Manual corrections use `POST /api/score/override`, disabled unless the Worker secret `SCORE_ADMIN_TOKEN` is configured. Supply bearer authorization and JSON fields `date`, `status` (`live` or `final`), `homeScore` and `awayScore`. Scores follow venue order, not always Klein Cain first. A live override pauses source updates for 15 minutes; a final stops them. There is no public editing interface.

## Weekly editions

`scripts/build-edition.mjs` is disabled. It writes the retired schema v1 and throws if run. Its research prompt is kept as the starting point for a v2 rewrite. `.github/workflows/weekly-edition.yml` still calls it and will fail until it is rewritten; the workflow is manual-only, so nothing runs on a schedule.

Before any automated generation is enabled, these have to be settled: how generated facts are verified against a source, how citations are captured per claim, what the page shows when a fact is unavailable, and what the API spend is per edition and per season.

## Remaining setup

- Verify Week 3 (Tomball at Klein Cain, September 18, 2026) against current public sources. Its content was carried over from the earlier hardcoded page and has not been rechecked.
- Design the cloud workflow for producing and publishing weekly editions.
- Approve and enforce a budget before enabling AI API calls.
- Confirm data-source permissions before commercial expansion.

## Recovery and future schools

Revert a bad source commit and redeploy to recover the site. Preserve GitHub Pages during migration. Cloudflare has Worker logs, deployment history, cron failures and KV data; GitHub Actions has build logs. KV is separate from the repository, so export it before deleting its namespace or changing accounts.

If the source fails, keep the last timestamped score or use an authenticated correction. Do not label stale data as current.

To add a school, add its configuration, hostname, schedule and sources, then make content selection depend on the school. Partition scores by school and game. The current Worker accepts only Klein Cain; adding DNS alone will not create another site. Review quotas and data rights before expanding.

## Design decisions

Keep matchup information compact, like Apple Sports or Yahoo Sports. Use sans-serif typography, small facts and expandable player reports. Preserve previews separately after final. Keep the roster and team photo near the bottom. Avoid oversized mastheads, decorative labels and unsupported postgame player claims.
