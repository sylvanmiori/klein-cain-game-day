# Game Day Report project guide

Updated September 5, 2026. Keep this file current when accounts, hosting or automation change. Never store passwords, tokens or payment details here.

## Ownership and addresses

- Owner/persona: Sylvan Miori, SylvanMiori@gmail.com.
- Repository: https://github.com/sylvanmiori/klein-cain-game-day
- Existing site: https://sylvanmiori.github.io/klein-cain-game-day/
- Domain: `gameday.report`, purchased through Cloudflare September 5, 2026, confirmed by the owner.
- Planned school address: `kleincain.gameday.report`. The parent domain will redirect here. No other schools are configured.

## Current status

Cloudflare code is prepared, score tests pass and the deployment dry run passes. Local Cloudflare authorization is complete. Live deployment and domain verification are still pending. GitHub Pages remains the public site.

The site contains Week 1, Week 2 and Week 3 pages. Some matchup content and metadata are still game-specific. The weekly research schedule is disabled until the page can safely render new editions. Email delivery has been removed from the workflow. This is a website-only project for now.

## Costs

Checkout quoted $19.20 registration and $19.20 annual renewal. The domain requires annual renewal, not a one-time lifetime purchase. Check Cloudflare for the invoice, renewal date and auto-renew setting.

The code targets Cloudflare's free Worker and KV allowances. Those quotas are finite; review usage before adding schools or substantial traffic. Optional AI research would have separate API charges and is not enabled. No paid hosting plan or email service has been configured by this migration.

## Publishing

Cloudflare will serve the static site and run the score service. GitHub stores the source and can build and publish without this computer being on.

Configuration: `cloudflare/wrangler.jsonc`. The provisioned `gameday-report-scores` KV namespace stores scores, and its namespace ID is saved in that file so future deployments reuse it.

GitHub Actions needs:

- Repository variable `CLOUDFLARE_ACCOUNT_ID`: Sylvan's account ID.
- Repository secret `CLOUDFLARE_API_TOKEN`: scoped deployment token, not the global API key.
- Repository variable `CLOUDFLARE_ENABLED`: set to `true` after the new site is verified.

Enter secret values directly in GitHub settings, never in source or chat. Local Cloudflare login does not authorize GitHub Actions.

When enabled, a push to `main` tests, builds and deploys to Cloudflare. The old GitHub live-score job is skipped when `CLOUDFLARE_ENABLED` is true, avoiding duplicate polling.

Local commands use Node 24 or newer: `npm ci`, `npm run test:score`, `npm run build:cloudflare`, then `npm run deploy:cloudflare` with Cloudflare authorization.

## Scores

The Worker checks the schedule every minute. It fetches scores during scheduled game nights from 6 PM through 2 AM Central, including after midnight. It stops fetching once a final is saved. Visible browser pages check once per minute and stop at final.

The source is Dave Campbell's Texas Football's score endpoint. It is an external dependency, not a guaranteed feed or commercial data agreement. Confirm permitted use before commercial expansion. Polling cannot make a score fresher than the source, and KV replication can add delay.

The parser requires an unambiguous team/opponent match and valid scores. A source failure leaves the previous score intact. The checked-in game has a fallback in `public/live-score.json`.

Manual corrections use `POST /api/score/override`, disabled unless the Worker secret `SCORE_ADMIN_TOKEN` is configured. Supply bearer authorization and JSON fields `date`, `status` (`live` or `final`), `homeScore` and `awayScore`. Scores follow venue order, not always Klein Cain first. A live override pauses source updates for 15 minutes; a final stops them. There is no public editing interface.

## Remaining setup

- Verify deployment, HTTPS, both domain routes, assets and the score endpoint.
- Configure GitHub deployment credentials and test cloud-only publishing.
- Make pages, matchup cards and metadata edition-driven before enabling weekly research.
- Verify each upcoming game's facts. Do not invent player statistics or recaps.
- Approve and enforce a budget before enabling AI API calls.
- Confirm data-source permissions before commercial expansion.

## Recovery and future schools

Revert a bad source commit and redeploy to recover the site. Preserve GitHub Pages during migration. Cloudflare has Worker logs, deployment history, cron failures and KV data; GitHub Actions has build logs. KV is separate from the repository, so export it before deleting its namespace or changing accounts.

If the source fails, keep the last timestamped score or use an authenticated correction. Do not label stale data as current.

To add a school, add its configuration, hostname, schedule and sources, then make content selection depend on the school. Partition scores by school and game. The current Worker accepts only Klein Cain; adding DNS alone will not create another site. Review quotas and data rights before expanding.

## Design decisions

Keep matchup information compact, like Apple Sports or Yahoo Sports. Use sans-serif typography, small facts and expandable player reports. Preserve previews separately after final. Keep the roster and team photo near the bottom. Avoid oversized mastheads, decorative labels and unsupported postgame player claims.
