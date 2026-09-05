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

## Advancing the season

`scripts/promote-edition.mjs` decides which edition the home page shows. The rule: a played game keeps the home page for three days, then the next upcoming edition takes over, so a Friday game is still current through Monday and hands over on Tuesday. `scripts/lib/season.mjs` holds the rule and is unit tested, including the case that matters most, that the edition is already current on its own game day so the live score card is on screen at kickoff.

The script also does two things that used to be manual and easy to forget:

- It rewrites `public/live-score.json` so its slug follows the current edition. The live score card reads that file to know which game to poll. Before this existed, a game night would have collected the score into KV while the home page still showed the previous week's final.
- It captures a verified `finalScore` once a game has been played, so a game keeps showing its result after it stops being current, without waiting for an authored recap.

`PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a handover or corrects one by hand.

## Automated facts

`scripts/refresh-facts.mjs` refreshes upcoming editions from public sources on a schedule. No language model runs in it. It may write only four fields: `home.record`, `away.record`, `prediction` and `weather`. Copy, players, headlines, sources and metadata stay editorial and are never touched by automation.

Sources, all free and unauthenticated:

- **Records** come from the District 15-6A standings table on the school's own Dave Campbell's team page, which is server rendered. One request covers every district opponent. Teams are matched on the exact string `"<name> <mascot>"` so `Klein` cannot match `Klein Cain`.
- **The model prediction** comes from the `pick` field of the same Dave Campbell's scores endpoint the live score already uses: `POST /api/schools/scoresGetJson` with the game date, then the row matching the school and opponent. It is shown on the page as **Model Prediction** and is deliberately **not hyperlinked**, because the field is not rendered on any public Dave Campbell's page. Their scores UI shows only status, teams and scores, and their own markup for a game omits it; it appears to feed the Pick'Em contest instead. Linking it would send a reader somewhere the number is not shown. It is a signed margin from Klein Cain's point of view. Verified across 2,236 completed games rather than assumed: 1,216 paired rows are exact negatives with no exceptions, which rules out a poll or a count, and the sign predicts the winner 71.0 percent of the time. The median absolute pick is 11 and the range is -71 to 71, a plausible margin scale.
- **Our rating** is computed in `scripts/lib/rating.mjs` from every Texas result so far, roughly 1,300 games across 1,435 teams by early September. It is the classic Massey least-squares method, which is public: assert `rating(winner) - rating(loser) = margin` for every game and solve the overdetermined system. It is **not** the rating published on masseyratings.com, which is a refined proprietary system, and the validator rejects any attempt to attribute it to Massey. Two modelling choices are ours rather than derived from data: margins are capped at 28 so running up the score earns nothing, and a ridge term keeps the system solvable while the game graph is still in disconnected pieces. Home advantage is measured from the data, not assumed. Nothing is published until both teams have at least four games, so early in a season it correctly shows nothing.
- **Statewide rank** comes from Dave Campbell's weekly "Computer Rankings for All 1,500 TXHSFB Teams" article. Team pages link the recent ones, so `findRankingsArticle` picks the newest by the date in its URL rather than guessing a slug, and the parser refuses anything yielding fewer than 500 teams. This is where the original `Cain 132 · Tomball 69` came from: the numbers were right when written and then froze. As of the Week 2 article they are Cain 81 and Tomball 43, which is exactly why they are now refreshed rather than typed in. The `NR` on a team page is the separate AP-style poll, not this ranking.
- **Weather** comes from the National Weather Service (`api.weather.gov`), which needs no key. The hourly feed reaches about six days ahead, so a game further out gets no weather rather than an invented one. A forecast older than three days is dropped at build time instead of shown.

Predictions follow a fixed order of preference: our own rating first, then Massey, then the Dave Campbell's pick. `predictionFact` picks the best available and labels the fact with the source, so a reader always knows whose number they are seeing, and the validator fails the build if a game before kickoff has none at all. The `massey` field exists and is always null today, for the reason below; the slot keeps the preference order explicit so it can be filled the day a permitted route appears.

Massey is deliberately not a source. `masseyratings.com` answers automated requests with a Cloudflare bot challenge, and its `robots.txt` disallows `/data/` and `/scores.php`. Getting around either would be bot-detection bypass, so the Dave Campbell's pick replaces it. The Massey numbers on the Week 2 page stay as authored editorial text.

`.github/workflows/refresh-facts.yml` promotes and then refreshes at 6 AM Central daily, and every three hours on Thursday and Friday when the forecast matters. The repository is public, so Actions minutes are free. Each run validates before committing, pushes to `main`, and Cloudflare rebuilds. Every automated fact change is a reviewable diff in git history.

The rating is all-or-nothing. A statewide scores response is around a megabyte and timed out from GitHub's runners on the first cloud run, which produced a rating from 758 of 1,315 games without stopping anything. Requests now allow 60 seconds and retry three times, and if any date is still unavailable the rating is skipped entirely rather than computed from a partial season.

Failure is quiet by design. A source that is down, changes shape or does not match the scheduled game is reported in the job log and the previous verified value is kept. The job does not fail the build, and nothing unverified reaches the page.

`npm run refresh` runs it locally; `node scripts/refresh-facts.mjs --dry-run` reports what would change without writing.

Two known limits. Statewide rank is not available from these sources: `hsRank` is 99999 on every row, and both Klein Cain and Tomball read `DCTF High School Ranking: NR` on their team pages. The Week 3 rank line claiming `Tomball 69 · Cain 132` was contradicted by the source the page cites, so it was removed rather than published unsupported. And `deploy.yml` ignores `content/**`, so a fact-only commit refreshes Cloudflare but not the GitHub Pages fallback.

One parsing trap worth remembering: the scores feed reports every game twice, once from each school, and **the two rows carry different game ids**. Keying on `gameId` silently double-counts every game, which is caught by a test in `scripts/lib/rating.test.mjs`. The stable key is the date plus the sorted team pair.

## The postgame recap

`scripts/lib/recap.mjs` composes the `final` section once a game has a captured score, and `promote-edition.mjs` applies it. No language model is involved. Every sentence restates something already verified: the score, the venue and date, the season record derived from captured results, and how the published prediction compared. It also rewrites the page and share titles, because a page still titled "Preview" after kickoff is wrong.

It deliberately produces no `leaders` and no player claims. No verified postgame player statistics are available from the sources this site uses, and the pregame players to watch must never be presented as though they performed.

An authored recap is never overwritten: the composer only fills a `final` section that is null. Rehearsed end to end at `PROMOTE_TODAY=2026-09-19` with a stubbed score, which produced the Final tab as the default view with the original preview preserved in its own tab.

A richer written recap would need a language model, and with it the cost, citation and review controls that are still not in place. The deterministic recap exists so that a game night never ends with the site showing a stale preview while those controls are decided.

## Weekly editions

`scripts/build-edition.mjs` is disabled. It writes the retired schema v1 and throws if run. Its research prompt is kept as the starting point for a v2 rewrite. `.github/workflows/weekly-edition.yml` still calls it and will fail until it is rewritten; the workflow is manual-only, so nothing runs on a schedule.

Before any automated generation is enabled, these have to be settled: how generated facts are verified against a source, how citations are captured per claim, what the page shows when a fact is unavailable, and what the API spend is per edition and per season.

## Remaining setup

- Verify Week 3 (Tomball at Klein Cain, September 18, 2026) against current public sources. Records, the pick, the rating and the forecast now refresh automatically, and the unsupported rank line has been removed, but the player capsules and the early-read copy were carried over from the earlier hardcoded page and have not been rechecked.
- Decide whether the recap should ever be written by a language model. The deterministic one covers the facts; anything more expressive needs the cost, citation and review controls that are still undecided.
- Design the cloud workflow for producing and publishing weekly editions.
- Approve and enforce a budget before enabling AI API calls.
- Confirm data-source permissions before commercial expansion.

## Recovery and future schools

Revert a bad source commit and redeploy to recover the site. Preserve GitHub Pages during migration. Cloudflare has Worker logs, deployment history, cron failures and KV data; GitHub Actions has build logs. KV is separate from the repository, so export it before deleting its namespace or changing accounts.

If the source fails, keep the last timestamped score or use an authenticated correction. Do not label stale data as current.

To add a school, add its configuration, hostname, schedule and sources, then make content selection depend on the school. Partition scores by school and game. The current Worker accepts only Klein Cain; adding DNS alone will not create another site. Review quotas and data rights before expanding.

## Design decisions

Keep matchup information compact, like Apple Sports or Yahoo Sports. Use sans-serif typography, small facts and expandable player reports. Preserve previews separately after final. Keep the roster and team photo near the bottom. Avoid oversized mastheads, decorative labels and unsupported postgame player claims.
