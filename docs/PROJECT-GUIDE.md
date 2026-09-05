# Game Day Report project guide

Updated September 5, 2026. Written to be picked up cold: read **Current status**, **Where things live** and **Traps worth knowing** first. Keep this file current when accounts, hosting or automation change. Never store passwords, tokens or payment details here.

## Ownership and addresses

- Owner/persona: Sylvan Miori, SylvanMiori@gmail.com.
- Repository: https://github.com/sylvanmiori/klein-cain-game-day
- Existing site: https://sylvanmiori.github.io/klein-cain-game-day/
- Domain: `gameday.report`, purchased through Cloudflare September 5, 2026, confirmed by the owner.
- Public school address: https://kleincain.gameday.report/. The parent domain redirects here. No other schools are configured.

## Current status

Live at https://kleincain.gameday.report/, deployed by Cloudflare Workers Builds on every push to `main`. GitHub Pages remains a fallback.

`/` is the Klein Cain program page. Each of the ten games has its own report at `/games/week-<n>`, rendered from one JSON file in `content/editions/` by `components/edition-page.tsx`. All ten editions exist and are validated.

The season runs unattended. A scheduled workflow creates missing editions, promotes the current game, refreshes facts from public sources and writes a postgame recap, all without a language model. See **Running unattended**.

What is still not automated is analysis: players to watch, keys, recruiting notes and any written narrative beyond the deterministic recap. No AI API is configured and none is called.

## Where things live

| Path | What it is |
| --- | --- |
| `app/page.tsx` | `/`, renders `components/team-page.tsx` |
| `app/games/[week]/page.tsx` | `/games/week-<n>`, renders `components/edition-page.tsx` |
| `content/editions/*.json` | one file per game, schema v2, typed in `lib/edition.ts` |
| `content/season-data.json` | machine-written: our results and every opponent's record |
| `content/roster-2026.json` | roster, hand-maintained |
| `config/season-2026.json` | the schedule; authority on date, opponent, venue, home/away, kickoff |
| `config/publication.json` | school, wordmark, source URLs |
| `config/program.json` | program history and past seasons |
| `config/venues.json` | venue coordinates, for the forecast |
| `scripts/lib/sources.mjs` | every external fetcher and parser |
| `scripts/lib/rating.mjs` | least-squares rating and team records |
| `scripts/lib/recap.mjs` | deterministic postgame recap |
| `scripts/lib/season.mjs` | which edition is current |
| `cloudflare/worker.mjs` | routes, score API, one-minute cron |

Machine-owned fields on an edition are `home.record`, `away.record`, `home.rank`, `away.rank`, `rankings`, `prediction`, `rating`, `weather`, `finalScore` and `stats`. Everything else is editorial and no script writes it.

## Costs

Checkout quoted $19.20 registration and $19.20 annual renewal. The domain requires annual renewal, not a one-time lifetime purchase. Check Cloudflare for the invoice, renewal date and auto-renew setting.

The code targets Cloudflare's free Worker and KV allowances. Those quotas are finite; review usage before adding schools or substantial traffic. Optional AI research would have separate API charges and is not enabled. No paid hosting plan or email service has been configured by this migration.

## The program page

`/` is the Klein Cain program page. It leads with whichever edition is current, using the live score card so the front page carries a live score on game night and the result for three days after, then switches to the next preview. Below that: the schedule with every opponent's record, program history, links to every game report, the season stat leaders and the full roster with the team photo.

Every game report is a subpage at `/games/week-<n>`, including whichever one is current. The program page and game reports share `SeasonHub`, `LiveScoreCard` and `SeasonStats`. `RosterSection` appears only on the program page.

The roster and team photo live only on the program page now, and the Roster link in a game page's masthead points at `/#roster-heading`. The wordmark in every masthead goes to `/`.

`/team` served the program page for a single deploy before it moved to `/`. The Worker answers it with a 301 to `/`, covered by a test.

## Editions

One JSON file per game in `content/editions/`, named for its slug. `content/editions/TEMPLATE.md` carries the starting block and the rules. The shape is typed in `lib/edition.ts` (schema v2).

- `config/season-2026.json` is the authority on date, opponent, venue, home/away and kickoff. An edition that disagrees fails validation.
- Exactly one edition sets `"current": true`. It supplies the featured matchup on the program page and enables live polling on its own game report. Every edition, including the current one, is prerendered at `/games/week-<n>` by `app/games/[week]/page.tsx`. The roster and team photo appear only on `/`.
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

Local commands use Node 24 or newer:

```
npm ci
npm run editions     # create a starter edition for any scheduled game lacking one
npm run promote      # set the current edition, capture a final score, write the recap
npm run refresh      # records, ranks, prediction, rating, forecast, results
npm run validate     # schema, schedule agreement and editorial rules
npm run test:score   # worker, score parser, rating, recap, promotion, stats
npm run build:cloudflare   # validates, builds, then re-checks the rendered pages
npm run deploy:cloudflare  # only needed for a manual deploy
```

`promote` and `refresh` both accept `--dry-run` when invoked directly, for example `node scripts/refresh-facts.mjs --dry-run`. `PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a specific day.

There are two build targets and they differ. `build:cloudflare` emits root-relative asset paths; the plain `build` used by GitHub Pages prefixes them with the repository name. A change that touches paths or URLs should be checked under both, since a bug once appeared only on the Pages path.

## Scores

The Worker checks the schedule every minute. It fetches scores during scheduled game nights from 6 PM through 2 AM Central, including after midnight. It stops fetching once a final is saved. Visible browser pages check once per minute and stop at final.

The source is Dave Campbell's Texas Football's score endpoint. It is an external dependency, not a guaranteed feed or commercial data agreement. Confirm permitted use before commercial expansion. Polling cannot make a score fresher than the source, and KV replication can add delay.

The parser requires an unambiguous team/opponent match and valid scores. A source failure leaves the previous score intact. The checked-in game has a fallback in `public/live-score.json`.

Manual corrections use `POST /api/score/override`, disabled unless the Worker secret `SCORE_ADMIN_TOKEN` is configured. Supply bearer authorization and JSON fields `date`, `status` (`live` or `final`), `homeScore` and `awayScore`. Scores follow venue order, not always Klein Cain first. A live override pauses source updates for 15 minutes; a final stops them. There is no public editing interface.

## Running unattended

The season now advances without anyone opening an editor. Every weekday at 6 AM Central, and every three hours on Thursday and Friday, one workflow runs four steps in order:

1. `build-editions.mjs` creates a starter page for any scheduled game that does not have one.
2. `promote-edition.mjs` moves the front page to the right game, captures a final score, writes the recap and snapshots the season statistics.
3. `refresh-facts.mjs` fills records, ranks, the prediction, our rating, the forecast, every opponent's record and our own results.
4. `validate-editions.mjs` gates the commit, and the build re-checks the rendered pages.

Simulated across the season, promotion lands on the right game every week: Sept 22 moves to Magnolia West, Oct 8 to Klein, Nov 6 to Klein Forest, and after the last game it stays there rather than falling off the end.

Two invariants keep it honest. The validator fails if any scheduled game has no edition, so the season cannot quietly stop producing pages. And it fails if a game before kickoff has no prediction from any source.

What automation still does not write is analysis. A generated edition has no players to watch, no keys and no recruiting notes, and its opening paragraph says only what is known and what updates later. Those sections stay empty until a person or a reviewed process fills them, because filling them automatically means inventing them.

## Advancing the season

`scripts/promote-edition.mjs` decides which edition the home page shows. The rule: a played game keeps the home page for three days, then the next upcoming edition takes over, so a Friday game is still current through Monday and hands over on Tuesday. `scripts/lib/season.mjs` holds the rule and is unit tested, including the case that matters most, that the edition is already current on its own game day so the live score card is on screen at kickoff.

The script also does two things that used to be manual and easy to forget:

- It rewrites `public/live-score.json` so its slug follows the current edition. The live score card reads that file to know which game to poll. Before this existed, a game night would have collected the score into KV while the home page still showed the previous week's final.
- It captures a verified `finalScore` once a game has been played, so a game keeps showing its result after it stops being current, without waiting for an authored recap.

`PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a handover or corrects one by hand.

## Automated facts

`scripts/refresh-facts.mjs` refreshes editions from public sources on a schedule. No language model runs in it. On an edition it may write `home.record`, `away.record`, both team ranks, `rankings`, `prediction`, `rating` and `weather`. It also writes results and opponent records to `content/season-data.json`. Copy, players, headlines, sources and metadata stay editorial and are never touched by automation.

Sources, all free and unauthenticated:

- **Records** come from the District 15-6A standings table on the school's own Dave Campbell's team page, which is server rendered. One request covers every district opponent. Teams are matched on the exact string `"<name> <mascot>"` so `Klein` cannot match `Klein Cain`.
- **The model prediction** comes from the `pick` field of the same Dave Campbell's scores endpoint the live score already uses: `POST /api/schools/scoresGetJson` with the game date, then the row matching the school and opponent. It is shown on the page as **Model Prediction** and is deliberately **not hyperlinked**, because the field is not rendered on any public Dave Campbell's page. Their scores UI shows only status, teams and scores, and their own markup for a game omits it; it appears to feed the Pick'Em contest instead. Linking it would send a reader somewhere the number is not shown. It is a signed margin from Klein Cain's point of view. Verified across 2,236 completed games rather than assumed: 1,216 paired rows are exact negatives with no exceptions, which rules out a poll or a count, and the sign predicts the winner 71.0 percent of the time. The median absolute pick is 11 and the range is -71 to 71, a plausible margin scale.
- **Our rating** is computed in `scripts/lib/rating.mjs` from every Texas result so far, roughly 1,300 games across 1,435 teams by early September. It is the classic Massey least-squares method, which is public: assert `rating(winner) - rating(loser) = margin` for every game and solve the overdetermined system. It is **not** the rating published on masseyratings.com, which is a refined proprietary system, and the validator rejects any attempt to attribute it to Massey. Two modelling choices are ours rather than derived from data: margins are capped at 28 so running up the score earns nothing, and a ridge term keeps the system solvable while the game graph is still in disconnected pieces. Home advantage is measured from the data, not assumed. Nothing is published until both teams have at least four games, so early in a season it correctly shows nothing.
- **Statewide rank** comes from Dave Campbell's weekly "Computer Rankings for All 1,500 TXHSFB Teams" article. Team pages link the recent ones, so `findRankingsArticle` picks the newest by the date in its URL rather than guessing a slug, and the parser refuses anything yielding fewer than 500 teams. This is where the original `Cain 132 · Tomball 69` came from: the numbers were right when written and then froze. As of the Week 2 article they are Cain 81 and Tomball 43, which is exactly why they are now refreshed rather than typed in. The `NR` on a team page is the separate AP-style poll, not this ranking.
- **Our own results** and the season record come from the same scan: `content/season-data.json` holds a result per game date, so the schedule and the record can no longer be hand-typed or drift from the opponent records beside them. `config/season-2026.json` no longer carries a `result` field.
- **Opponent records** in the schedule are computed from the same complete season scan the rating uses, so they cost no extra requests, and are written to `content/season-data.json` alongside our own results, rather than into the hand-maintained schedule. Teams are matched on Dave Campbell's exact school name; `config/season-2026.json` carries a `dctfName` where it differs, which today is Oak Ridge, listed there as "Conroe Oak Ridge". Exact matching matters: the feed also contains "Arlington Oakridge", and a substring match on "Klein" would hit five different schools. As a cross-check, all eight district opponents agree exactly with the standings table, which is a separate source.
- **Weather** comes from the National Weather Service (`api.weather.gov`), which needs no key. The hourly feed reaches about six days ahead, so a game further out gets no weather rather than an invented one. A forecast older than three days is dropped at build time instead of shown.

Predictions follow a fixed order of preference: our own rating first, then Massey, then the Dave Campbell's pick. `predictionFact` picks the best available and labels the fact with the source, so a reader always knows whose number they are seeing, and the validator fails the build if a game before kickoff has none at all. The `massey` field exists and is always null today, for the reason below; the slot keeps the preference order explicit so it can be filled the day a permitted route appears.

Massey is deliberately not a source. `masseyratings.com` answers automated requests with a Cloudflare bot challenge, and its `robots.txt` disallows `/data/` and `/scores.php`. Getting around either would be bot-detection bypass, so the Dave Campbell's pick replaces it. The Massey numbers on the Week 2 page stay as authored editorial text.

`.github/workflows/refresh-facts.yml` promotes and then refreshes at 6 AM Central daily, and every three hours on Thursday and Friday when the forecast matters. The repository is public, so Actions minutes are free. Each run validates before committing, pushes to `main`, and Cloudflare rebuilds. Every automated fact change is a reviewable diff in git history.

The rating is all-or-nothing. A statewide scores response is around a megabyte and timed out from GitHub's runners on the first cloud run, which produced a rating from 758 of 1,315 games without stopping anything. Requests now allow 60 seconds and retry three times, and if any date is still unavailable the rating is skipped entirely rather than computed from a partial season.

Failure is quiet by design. A source that is down, changes shape or does not match the scheduled game is reported in the job log and the previous verified value is kept. The job does not fail the build, and nothing unverified reaches the page.

`npm run refresh` runs it locally; `node scripts/refresh-facts.mjs --dry-run` reports what would change without writing.

One publishing limit remains: `deploy.yml` ignores `content/**`, so a fact-only commit refreshes Cloudflare but not the GitHub Pages fallback. The `NR` shown on Dave Campbell's team pages is a different poll from the statewide computer ranking used by this site.

One parsing trap worth remembering: the scores feed reports every game twice, once from each school, and **the two rows carry different game ids**. Keying on `gameId` silently double-counts every game, which is caught by a test in `scripts/lib/rating.test.mjs`. The stable key is the date plus the sorted team pair.

## Season statistics

Once a played game is reflected in the source, `promote-edition.mjs` snapshots MaxPreps season stat leaders into that edition and the Final view renders them: 31 leaders across 13 categories as of the Week 2 game, covering passing, rushing, receiving, tackles, sacks, interceptions, turnovers, completion percentage and QB rating.

The source is the team stats page, which ships its data as a `__NEXT_DATA__` JSON block, so `parseStatLeaders` reads structured values rather than scraping rendered markup. MaxPreps `robots.txt` disallows `/school/`, `/team/`, `/scores/` and a long list of minor sports, but not this path; checked with a robots parser rather than by eye. There is no bot challenge.

Three things this deliberately does not do.

- **It never claims to be a box score.** These are season-to-date totals, and the heading says "Season totals, not this game alone" with the date the source entered them. A single game's box score does exist on MaxPreps but only inside the App Router streaming payload, which is far more brittle to parse; that is not attempted.
- **It never backfills.** MaxPreps serves current totals with no history, so only the most recently played game may take a snapshot. Backfilling Week 1 would describe it with statistics from games played after it, which the first run did until this rule was added.
- **It never snapshots too early.** The source enters a Friday game the following morning, so a snapshot is taken only when the source's own `lastUpdated` date is after the game date. Otherwise the job says so and tries again the next day.

Every failure mode is covered by tests in `scripts/lib/stats.test.mjs`: a missing data block, malformed JSON, an empty leader list, rows missing a name or value, and missing freshness information all raise rather than publish a thin or silent result. A zero is kept, because zero is a real statistic.

## The postgame recap

`scripts/lib/recap.mjs` composes the `final` section once a game has a captured score, and `promote-edition.mjs` applies it. No language model is involved. Every sentence restates something already verified: the score, the venue and date, the season record derived from captured results, and how the published prediction compared. It also rewrites the page and share titles, because a page still titled "Preview" after kickoff is wrong.

It deliberately produces no `leaders` and no player claims. No verified postgame player statistics are available from the sources this site uses, and the pregame players to watch must never be presented as though they performed.

An authored recap is never overwritten: the composer only fills a `final` section that is null. Rehearsed end to end at `PROMOTE_TODAY=2026-09-19` with a stubbed score, which produced the Final tab as the default view with the original preview preserved in its own tab.

A richer written recap would need a language model, and with it the cost, citation and review controls that are still not in place. The deterministic recap exists so that a game night never ends with the site showing a stale preview while those controls are decided.

## Enabling a language model later

Nothing in this repository calls an AI API. The v1 research script and its
`weekly-edition.yml` workflow were removed once the deterministic pipeline
replaced them; the old research prompt is in git history at commit `cf61b8b`
if it is ever wanted as a starting point.

Before any generated prose ships, four things need settling: how each generated
fact is verified against a named source, how citations are captured per claim,
what the page shows when a fact is unavailable, and the API spend per edition
and per season. The house rules stand regardless: never invent player
statistics, recruiting status, rankings, star ratings, records, results or
postgame performance, and never imply a pregame player performed well without
verified postgame statistics.

## Open items

- Week 3 (Tomball, September 18) still carries player capsules and an early-read paragraph inherited from the original hardcoded page. Records, ranks, the prediction and the forecast refresh themselves; the prose has not been rechecked against a source.
- Weeks 4 to 10 are generated pages: real facts, no player capsules or keys. They stay that way until someone writes them or the AI path above is approved.
- Seven district opponents fall back to `public/team-placeholder.svg`. Real artwork would improve the matchup cards.
- The opponent's season leaders could sit alongside ours; `fetchStatLeaders` works against any MaxPreps team stats URL.
- `deploy.yml` ignores `content/**`, so a facts-only commit refreshes Cloudflare but not the GitHub Pages fallback.
- Confirm data-source permissions before any commercial use.

## Traps worth knowing

Each of these cost real debugging time. They are recorded so the next person does not pay twice.

- **The scores feed reports every game twice, once per school, and the two rows carry different game ids.** Keying on `gameId` silently double-counts every game and inflates the whole rating. The stable key is the date plus the sorted team pair. Covered by a test in `scripts/lib/rating.test.mjs`.
- **Team names must match exactly.** The feed contains `Klein`, `Klein Cain`, `Klein Collins`, `Klein Forest` and `Klein Oak`, plus `Magnolia` and `Magnolia West`, plus `Arlington Oakridge` alongside `Conroe Oak Ridge`. Substring matching is wrong in every one of those cases. Where a schedule name differs from the feed's, the schedule carries a `dctfName`.
- **Massey is not available.** `masseyratings.com` answers automated requests with a Cloudflare bot challenge, and its `robots.txt` disallows `/data/` and `/scores.php`, which is exactly the CSV endpoint older scrapers used. Working around either would be bot-detection bypass. The `massey` field exists on every edition and stays null.
- **The model prediction is not on any public page.** It comes from the `pick` field of the scores API and is not rendered anywhere on Dave Campbell's own site, so the fact is deliberately not hyperlinked. Its meaning was verified across 2,236 games: 1,216 paired rows are exact negatives and the sign picks the winner 71 percent of the time.
- **Statewide rank does not come from the team page.** The `Ranking: NR` shown there is a separate AP-style poll. The number the site uses comes from the weekly "Computer Rankings for All 1,500 TXHSFB Teams" article, discovered by the date in its URL.
- **MaxPreps serves current season totals with no history.** Only the most recently played game may snapshot statistics; backfilling an older game describes it with games played after it.
- **Decode HTML entities before collapsing whitespace.** The rankings table separates a team from its record with `&nbsp;`, which is not `\s` until decoded, so keys came out as `Klein Cain&nbsp;`.
- **A CSS margin is not a space.** Two elements separated only by `margin-left` read as `ThuAug 27` to a screen reader and when copied. Put a real space in the markup.
- **Measuring a CSS transition in a hidden browser pane gives the start value forever**, because no animation frames run. A `max-height` read as a stuck 60px and looked exactly like a broken cascade. Disable the transition before measuring.
- **Cloudflare's check-run registers a little after the push.** A wait loop that only counts completed checks can exit before Workers Builds appears and report success too early. Wait for the check by name.

## Recovery and future schools

Revert a bad source commit and redeploy to recover the site. Preserve GitHub Pages during migration. Cloudflare has Worker logs, deployment history, cron failures and KV data; GitHub Actions has build logs. KV is separate from the repository, so export it before deleting its namespace or changing accounts.

If the source fails, keep the last timestamped score or use an authenticated correction. Do not label stale data as current.

To add a school, add its configuration, hostname, schedule and sources, then make content selection depend on the school. Partition scores by school and game. The current Worker accepts only Klein Cain; adding DNS alone will not create another site. Review quotas and data rights before expanding.

## Design decisions

The visual reference is Apple Sports and Yahoo Sports: compact, useful, information first. Sans-serif throughout, no serif faces, no oversized mastheads, no decorative eyebrow labels, no generic sports hype. Lead with the matchup, records, game facts and players to watch.

- Every band on the page aligns to one column, through the `--pad` custom property. Do not reintroduce `4vw` padding or per-section containers; they drifted apart at wide widths.
- Player reports are compact. On a phone each shows two clamped lines and expands in place, one at a time.
- After a game the final view is the default and the original preview stays in its own tab.
- The roster in small type and the team photo live on the program page, not on each game report.
- Colour reinforces meaning, never carries it alone: the W or L is always written out, and the school is purple with the opponent in red, matching the player cards.
- Links stay clean, without decorative arrows, and every interactive element has a visible focus state.
- Test desktop and mobile before publishing.
