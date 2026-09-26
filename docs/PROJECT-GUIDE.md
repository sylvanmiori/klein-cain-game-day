# Game Day Report project guide

Updated September 23, 2026. Written to be picked up cold: an AI developer should read repository-root `AGENTS.md`, then **Current status**, **Where things live** and **Traps worth knowing** here. Keep this file current when accounts, hosting, automation, sources, commands or data ownership change. Never store passwords, tokens or payment details here.

## Ownership and addresses

- Owner/persona: Sylvan Miori, SylvanMiori@gmail.com.
- Repository: https://github.com/sylvanmiori/klein-cain-game-day
- Existing site: https://sylvanmiori.github.io/klein-cain-game-day/
- Domain: `gameday.report`, purchased through Cloudflare September 5, 2026, confirmed by the owner.
- Public school address: https://kleincain.gameday.report/. The parent domain redirects here. No other schools are configured.
- Google Analytics 4 (added 2026-09-22): account "Klein Cain Gameday Report" (stevenlmiori@gmail.com), property "kleincain.gameday.report", measurement ID `G-KXFWBBSXFL`, wired into `app/layout.tsx` via `next/script`. The ID is a public identifier, not a secret.

## Current status

Live at https://kleincain.gameday.report/, deployed by Cloudflare Workers Builds on every push to `main`. GitHub Pages remains a fallback.

`/` is the Klein Cain program page with a unified Next Game card (hero + matchup strip) for the current edition (Week 4 at Magnolia West), followed by a unified Latest Recap feature card (recap narrative, lead photo, Player of the Game spotlight, and gallery links) for the latest final (Week 3 vs. Tomball), then schedule and the rest of the program hub. Each of the ten games has its own report at `/games/week-<n>`, rendered from one JSON file in `content/editions/` by `components/edition-page.tsx`. All ten editions exist and are validated. Weeks 1–3 are finals with recaps, game statistics, and photo galleries (Week 1 includes game highlight video); Week 4 is the current preview with complete player capsules and audits; Weeks 5–10 are starter editions.

The season runs unattended. A scheduled workflow creates missing editions, promotes the current game, refreshes facts from public sources and writes a postgame recap. See **Running unattended**.

Analysis is editorial: players to watch, keys, recruiting notes and any written narrative are written by Sylvan, the appointed editor-in-charge, under the same fact-verification standards the automation follows. See **Editorial model**.

All ten scheduled opponents now have local logo files. As checked September 5, 2026, MaxPreps exposed 57 portraits on its 66-player varsity roster; those exact-name matches are stored locally and available to Player of the Game. The site roster tracks that same varsity list; run `npm run roster` when MaxPreps changes numbers or names.

## Where things live

| Path | What it is |
| --- | --- |
| `app/page.tsx` | `/`, renders `components/team-page.tsx` |
| `app/games/[week]/page.tsx` | `/games/week-<n>`, renders `components/edition-page.tsx` |
| `components/program-home-spotlight.tsx` | homepage stack: Next Game card + unified Latest Recap feature card |
| `components/home-next-game-card.tsx` | unified Next Game module (feature hero + matchup strip + live score poll) |
| `components/game-photos.tsx` | accessible photo gallery grid, native `<dialog>` lightbox modal with keyboard navigation, photographer credits |
| `components/game-video.tsx` | game highlight video player with poster, duration, and credit |
| `components/seo-schema.tsx` | Schema.org JSON-LD structured data generators (SportsTeam, SportsEvent, NewsArticle, BreadcrumbList, ImageGallery) |
| `content/editions/*.json` | one file per game, schema v2, typed in `lib/edition.ts` |
| `content/season-data.json` | machine-written: our results, every opponent's record, and district standings |
| `content/roster-2026.json` | varsity roster synced from MaxPreps with `npm run roster`; local portrait paths are synced with `npm run photos` |
| `config/season-2026.json` | the schedule; authority on date, opponent, venue, home/away, kickoff |
| `config/opponent-logos.json` | exact MaxPreps profile used for each scheduled opponent's logo |
| `config/publication.json` | school, wordmark, source URLs, homepage hero asset paths |
| `config/coaches.json` | head coaches for Klein Cain and every scheduled opponent, with bios and verified career stops; rendered on previews and the program page |
| `config/program.json` | program history and past seasons |
| `config/venues.json` | venue coordinates, for the forecast |
| `content/galleries/*.json` | editorial game photography, one file per game slug; not written by score or facts automation |
| `lib/galleries.ts` | types and loaders for editorial game galleries |
| `app/photos/page.tsx` | `/photos`, season gallery grouped by game |
| `public/photos/` | local game photos; do not hotlink SmugMug |
| `public/videos/` | local MP4 highlights and poster images; do not hotlink external streams |
| `public/robots.txt` | crawler directives and sitemap declaration |
| `public/sitemap.xml` | generated XML sitemap of all routes with Git-backed last significant change dates when available |
| `public/brand/cain-helmet-avatar-source.png` | approved 1254px purple-helmet master for the site identity; two stacked flags without a C or Cain script |
| `public/launch/` | direct-link launch graphics in wide (1920×1080), square (1080×1080) and vertical (1080×1920) formats; not placed on any page |
| `scripts/build-brand-assets.mjs` | rebuilds favicon PNGs/ICO, touch icons, share card, and homepage helmet images from that master |
| `scripts/generate-sitemap.mjs` | generates public/sitemap.xml before builds |
| `scripts/lib/caption-helper.mjs` | roster resolution and quality validation for photo captions |
| `scripts/lib/player-of-game.mjs` | deterministic Cain Impact v1 model for Player of the Game |
| `scripts/lib/sources.mjs` | every external fetcher and parser |
| `scripts/lib/rating.mjs` | least-squares rating and team records |
| `scripts/lib/recap.mjs` | deterministic postgame recap |
| `scripts/lib/season.mjs` | which edition is current |
| `cloudflare/worker.mjs` | routes, score API, one-minute cron |
| `AGENTS.md` | short, mandatory handoff rules for an AI developer |
| `scripts/check-docs.mjs` | build gate for stale documented paths and npm commands |
| `brand/social-2026/` | archived, rejected GD social concept; do not use it for the current site or accounts |

The approved purple helmet is now the visual mark on the masthead and Klein Cain matchup cards through `publication.schoolLogo` (`/favicon.png`). Its master is local and unchanged; resizing/compositing only is done by `npm run brand:assets`. The same command produces a square 48px PNG for Google Search, 16/32/96/192/512px PNGs, a multi-size `/favicon.ico`, 180px Apple touch icon, web-app manifest icon, the general `/og.png` share image, and both homepage helmet hero files. `lib/site-icons.ts` is the single HTML metadata definition for all pages. Google Search's icon is eligible after recrawl, not guaranteed immediately; keep `/favicon-48x48.png` stable and crawlable. The older silver helmet imagery contained an incorrect Texas-like/Cain-script decal and must not be reused as the public identity.

The `/launch/` graphics are separate social assets. They are image-generated mockups using the approved helmet and screenshots as references. The small device-screen text is illustrative and the visible Week 4 matchup is time-specific. These files are intentionally unlinked from site navigation and pages; share their direct URLs or download them for social posts.

### Favicon contract

The favicon is the approved purple helmet, and only the purple helmet. Source of truth is `public/brand/cain-helmet-avatar-source.png`. Never substitute another mark (including the rejected GD logo-mark in `brand/social-2026/`, which is archived and must not be used).

- `npm run brand:assets` (`scripts/build-brand-assets.mjs`) is the only way favicon files are produced. It regenerates `favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `favicon-96x96.png`, `favicon-192x192.png`, `favicon.png` (512), the multi-size `favicon.ico` (16/32/48 frames), `apple-touch-icon.png` (180), and `icon-512x512.png` from the master. Never hand-edit these files; rerun the script instead. `favicon.svg` is a build product of that script, so it stays in sync with the master and must never be deleted (a placeholder `favicon.svg` was removed in `b0e0a6a`; the current one is generated from the helmet master).
- `lib/site-icons.ts` is the single HTML metadata definition for all pages: SVG icon for modern browsers, the exact-48px PNG declaration, 16/32/192 PNGs, `favicon.ico` shortcut, and the Apple touch icon.
- Google Search requirements, all satisfied: an exact multiple-of-48px PNG explicitly declared via `link rel="icon"` (`/favicon-48x48.png`), a physical multi-resolution `/favicon.ico` at the domain root, and zero redirects on favicon fetches (Google-Favicon refuses to follow redirects). Google does not use SVG favicons; the PNG/ICO assets are the Google-facing set.
- `cloudflare/worker.mjs` serves `/favicon*`, `/apple-touch-icon.png`, `/site.webmanifest`, and `/robots.txt` on `gameday.report` directly with HTTP 200 (no redirect), and 301-redirects everything else on `gameday.report` permanently to `kleincain.gameday.report`. Never change that redirect back to a 302: the temporary redirect caused Google to index `gameday.report` instead of `kleincain.gameday.report`.

### Search visibility

`kleincain.gameday.report` is the canonical school address. The homepage, photos and ten game reports are listed in `public/sitemap.xml` and linked from the site; `public/robots.txt` declares the sitemap. `scripts/generate-sitemap.mjs` uses the most recent relevant Git commit for each page's `lastmod` and omits it when Git provenance is unavailable. A build alone does not claim every page changed. Google ignores sitemap `priority` and `changefreq`, so those tags are not emitted.

The homepage `WebSite` structured data names **Cain Game Day**, matching the masthead and Open Graph site name. Its publisher is the independent **Game Day Report** organization. `SportsTeam` describes Klein Cain and points to the official athletics and MaxPreps team pages; the publication's X account is not presented as the school's account. Game report `NewsArticle` structured data omits publication and modification dates until the edition model records verified editorial timestamps. The former markup used the *game date* at midnight, including future games, which was not a publication date.

On September 23, 2026, the owner confirmed that the school subdomain is verified in Google Search Console and `https://kleincain.gameday.report/sitemap.xml` has been submitted; this was not independently inspected from the repository. Next, measure impressions, average position and clicks for “Klein Cain football,” “Klein Cain High School football,” and “Klein Cain varsity football” by page and query. A `site:` search establishes discovery, not ranking. Search position varies by searcher and cannot be guaranteed. Links from the official athletics site, booster club, photographers and credible local coverage would strengthen discovery, but seek permission before asking anyone to link.

Machine-owned fields on an edition are `home.record`, `away.record`, `home.rank`, `away.rank`, `rankings`, `prediction`, `rating`, `weather`, `finalScore`, `stats` and `gameStats` (including `gameStats.playerOfGame`). Everything else is editorial and no script writes it. `recapNotes` is editorial input: scripts read it when composing or updating the recap but never fill it.

`npm run roster` reads the public MaxPreps varsity roster and rewrites `content/roster-2026.json`, keeping any existing local portrait paths when the name still matches. When MaxPreps leaves a player's position or class blank, the `OVERRIDES` map at the top of `scripts/sync-roster.mjs` fills it from a verified source (each entry notes its source); overrides are applied after the MaxPreps parse so a re-sync never wipes them. `npm run photos` downloads available mugshots into `public/players/` and records each exact-name match on the roster. Player-of-the-Game selections inherit that local image automatically; players without a verified portrait retain the jersey-number fallback.

`npm run logos` downloads any missing scheduled-opponent marks from the exact MaxPreps profiles in `config/opponent-logos.json`, stores them locally in `public/`, and replaces placeholder paths in the edition files. Every scheduled opponent must have a configured profile, so a new opponent cannot silently ship with the wrong school's similarly named logo.

The recurring facts workflow does not run `photos` or `logos`. Those are intentional setup commands: run `logos` after adding a schedule opponent or changing its exact source profile, and run `photos` when the Klein Cain roster portraits have changed. Production validation rejects placeholder and missing team logos.

## Costs

Checkout quoted $19.20 registration and $19.20 annual renewal. The domain requires annual renewal, not a one-time lifetime purchase. Check Cloudflare for the invoice, renewal date and auto-renew setting.

The code targets Cloudflare's free Worker and KV allowances. Those quotas are finite; review usage before adding schools or substantial traffic. Optional AI research would have separate API charges and is not enabled. No paid hosting plan or email service has been configured by this migration.

## The program page

`/` is the Klein Cain program homepage. Above the fold it shows the season record, then one unified **Next Game** card for whichever edition promotion marks current, followed by a unified **Latest Recap** feature card for the most recent final. The full schedule, district standings, program history, links to every game report, season stat leaders, head coach bio and roster follow on the same page. Full previews and recaps render on `/games/week-<n>`.

### Next Game card and Latest Recap feature

`components/home-next-game-card.tsx` is one outer card with two zones, not two stacked widgets:

1. **Feature zone** — dark editorial hero. Left column: Next game kicker, matchup headline, week/district, date/time/venue with icons, single Game Preview CTA. Right side: local photographic hero (`publication.heroNextGameImage` → `public/hero-next-game.jpg`) framed with `object-fit: cover` and a left-to-right black edge gradient so the photo never shows a hard rectangular seam into the text. Live/final games add a compact status line in this zone; scheduled games do not repeat date, kickoff or district in a second header.
2. **Matchup strip** — same card, separated by a 1px translucent divider. Team logos, names and records (or live scores), then a compact Last meeting / Texas rank row. No second preview button.

`ProgramHomeSpotlight` (`components/program-home-spotlight.tsx`) wires that card together with the unified Latest Recap feature card (`article.home-recap`). Instead of stacking a separate photo banner above a small text teaser, this card integrates the story's visual hero, camera badge, photo caption, result status ("W 55–38"), recap headline, lead excerpt, Player of the Game spotlight, and dual actions ("Read full game recap →" and "View N photos →"). Hierarchy on `/` is: program intro → Next Game card → Latest Recap feature card → schedule / reports / stats / coach / roster.

Game photography is editorial and lives in `content/galleries/`, one JSON file per game slug, separate from the edition file so promotion and fact refresh cannot overwrite it. Each photo is a local file under `public/photos/`. A gallery names one `lead` frame for the recap opening, additional `recap` frames in the story, one `home` frame for the homepage, and one `thumb` for the recap card. Every frame also appears in the game's photo section and on `/photos`. Watermarks stay in the files. Photo captions and alt text must be written in high-caliber sports journalism style, identifying players by full name, position, and jersey number resolved against `content/roster-2026.json` (or opponent rosters). Low-IQ or unresolved placeholders like "Jersey 1 turns upfield" are rejected by `scripts/validate-editions.mjs` via `scripts/lib/caption-helper.mjs`.

Photographer recognition is elevated across both game galleries and `/photos`:
- **Gallery headers** display a camera icon, byline ("Photography by [Name]"), photo count chip, and direct "View full album ↗" link.
- **Gallery footers** provide a prominent attribution block: "Photography by [Name] · View full SmugMug album & downloads ↗".
- **Accessible modal lightbox**: Clicking any photo in the recap story, game gallery, or on `/photos` opens a full-screen lightbox modal using native HTML `<dialog>` (`components/game-photos.tsx`) with top-right 'X' close button, native `Escape` dismissal, backdrop light-dismiss, previous/next chevron buttons, `ArrowLeft`/`ArrowRight` keyboard cycling, and full photo captions.

### Game highlight video

Game recap pages support local MP4 video highlights embedded via `components/game-video.tsx` when `final.video` is defined in the edition JSON (`lib/edition.ts`). Video assets and poster frames are stored locally under `public/videos/*` (e.g. `public/videos/2026-08-27-humble/highlights.mp4`). The component renders a styled video player with custom poster, duration badge, title, contextual caption, and credit link (e.g., "Texan Live · NFHS Network"). `scripts/validate-editions.mjs` verifies that `poster` and `src` paths exist locally in `public/` and that `sourceUrl` is an https link.

### Embedded X posts

Game recap pages can embed X posts as native site cards via `components/tweet-embed.tsx` when `final.socialPosts` is defined in the edition JSON (`lib/edition.ts`). The card renders the author's name, handle, verification, post text and an optional media link row in the site's own visual language — no X widget scripts and no hotlinked assets; every card links out to the original post. The posts appear in a "What they're saying" section between the photo story and the highlight video.

Between games, the recap card points at the most recent final. On the Monday of the next game's week, promotion moves the Next Game card to that preview. While a featured game is final, its recap, Player of the Game and game statistics appear on that game's report page, not on `/`.

Every game report is a subpage at `/games/week-<n>`, including whichever one is current. The program page and game reports share `SeasonHub`, including the district standings card, and `SeasonStats`. Live polling for the featured game lives inside `HomeNextGameCard` (not a separate homepage score widget). `RosterSection` appears only on the program page.

On a final matchup layout (game report cards and the Next Game strip), Klein Cain stays on the left whether the game is home or away; the opponent is on the right. The winner stays at full contrast and the losing name and score are muted. A small green or red dot sits on the midfield side of Klein Cain's score to show the result without moving the number off-center. The score itself stays white; result color is intentionally limited to the dot.

The roster and team photo live only on the program page now, and the Roster link in a game page's masthead points at `/#roster-heading`. The wordmark in every masthead goes to `/`.

`/team` served the program page for a single deploy before it moved to `/`. The Worker answers it with a 301 to `/`, covered by a test.

## Editions

One JSON file per game in `content/editions/`, named for its slug. `content/editions/TEMPLATE.md` carries the starting block and the rules. The shape is typed in `lib/edition.ts` (schema v2).

- `config/season-2026.json` is the authority on date, opponent, venue, home/away and kickoff. An edition that disagrees fails validation.
- Exactly one edition sets `"current": true`. It drives the homepage Next Game card (including live polling) and enables live polling on that game's report. Every edition, including the current one, is prerendered at `/games/week-<n>` by `app/games/[week]/page.tsx`. The roster and team photo appear only on `/`.
- `config/publication.json` holds the school, wordmark, site-level sources and homepage hero asset paths (`heroNextGameImage`, `heroHelmetCutout`). `config/program.json` holds program history and past seasons. The season record in the schedule card is derived from recorded results.
- Editions are their own archive. The retired `content/current-edition.json` and `content/archive/` were removed with schema v1.

To publish a new game: add the file, set `current` on the right edition, run `npm run validate`, `npm run build:cloudflare`, then push to `main`.

### Guardrails

Two scripts run automatically as part of `npm run build` and `npm run build:cloudflare`. Both exit non-zero and stop the build.

- `scripts/validate-editions.mjs` checks structure against the schedule and enforces the editorial rules: a preview player must carry a rating or say plainly that none is listed, and a current preview with player capsules must record a team-by-team MaxPreps audit completed within two days of kickoff. A recruiting row must carry an https source, and a full opponent-player section must record a dated roster-wide recruiting audit. Every verified college commit and every player ranked by a named service in the top 10 at his position or top 100 nationally must be included and clearly identified. Postgame leaders need a stat and a named box score, the disclaimer must name the opponent, a preview must have content, and every team logo must be a real local file rather than a placeholder. When highlight video is included (`final.video`), video and poster paths must exist locally under `public/`, `title` must be non-empty, and source attributions must use https. Recap commentary must be woven into `final.body` rather than an isolated "Extra" section, and quotes must be attributed as statements to reporters/Game Day rather than assuming team-speech context (e.g. "told the team" is rejected). A game gallery, when present, must match an edition slug, use local photo files, mark exactly one `lead`, one `home` and one `thumb`, and must use smart, roster-resolved player identifications (generic "Jersey X" placeholders fail validation). Captions and recaps are also verified against leadership hallucinations: head coach names must match verified coaches from `config/coaches.json` and campus principal references must match `publication.campusPrincipal`.
- `scripts/check-build.mjs` reads the built HTML and fails if a page's title, meta tags, heading or disclaimer names an opponent from a different week. Both checks account for schedule names that are prefixes of others, such as Klein and Klein Cain, or Magnolia and Magnolia West.
- `scripts/check-docs.mjs` reads the README, `AGENTS.md` and this guide and fails if a referenced repository path or `npm run` command no longer exists. It also parses the edition template's JSON example against the current top-level schema and verifies that every scheduled opponent has exactly one MaxPreps logo source.

These are the reason weekly research can be enabled later without a person rereading every page. They check shape and staleness, not truth. Nothing verifies that a statistic is real, so generated facts still need a human or a cited source.

## Publishing

Cloudflare will serve the static site and run the score service. GitHub stores the source and can build and publish without this computer being on.

Configuration: `cloudflare/wrangler.jsonc`. The provisioned `gameday-report-scores` KV namespace stores scores, and its namespace ID is saved in that file so future deployments reuse it.

Automatic publishing uses Cloudflare Workers Builds connected directly to the GitHub repository. In the existing `gameday-report` Worker, open **Settings → Builds → Connect**, choose `sylvanmiori/klein-cain-game-day`, use `main` as the production branch and the repository root as the root directory. Set the build command to `npm run build:cloudflare` and the deploy command to `npm run deploy:cloudflare`. This connection avoids a long-lived Cloudflare token in GitHub.

After the connection is tested, pushes to `main` build and deploy without this computer. The old GitHub score schedule is disabled; its manual workflow remains only as a fallback for GitHub Pages.

CI uses Node 24. Node 24 is recommended locally; `package.json` declares Node 22.13 as the minimum:

```
npm ci
npm run editions     # create a starter edition for any scheduled game lacking one
npm run promote      # set the current edition, capture a final score, write the recap
npm run postgame     # manual alias for postgame stats + Player of the Game
npm run refresh      # records, ranks, prediction, rating, forecast, results
npm run roster       # sync the varsity roster from MaxPreps and keep local portraits
npm run photos       # sync available Klein Cain portraits from the configured roster source
npm run logos        # sync all configured scheduled-opponent logos and edition paths
npm run docs:check   # catch stale paths and npm commands in the handoff docs
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

On busy Friday nights the Dave Campbell's scores endpoint returns every Texas game for that date in one payload (about 2.5 MB and 1,000+ rows, each with HTML `render` markup). The scheduled Worker must stay inside Cloudflare's per-invocation CPU budget, so `cloudflare/score.mjs` extracts only the matching Klein Cain row from the inner `data` JSON string instead of parsing the full array into thousands of objects. That keeps the one-minute cron reliable when the feed grows.

Manual corrections use `POST /api/score/override`, disabled unless the Worker secret `SCORE_ADMIN_TOKEN` is configured. Supply bearer authorization and JSON fields `date`, `status` (`live` or `final`), `homeScore` and `awayScore`. Scores follow venue order, not always Klein Cain first. A live override pauses source updates for 15 minutes; a final stops them. There is no public editing interface.

## Running unattended

The season now advances without anyone opening an editor. At 6 AM Central daily, every three hours on Thursday and Friday, and three times on Saturday while postgame statistics are being entered, one workflow runs four steps in order:

1. `build-editions.mjs` creates a starter page for any scheduled game that does not have one.
2. `promote-edition.mjs` moves the front page to the right game, captures a final score, writes the recap, snapshots the season statistics and adds game-only statistics when MaxPreps posts them.
3. `refresh-facts.mjs` fills records, ranks, the prediction, our rating, the forecast, every opponent's record and our own results.
4. `validate-editions.mjs` gates the commit, and the build re-checks the rendered pages.

Simulated across the season, promotion lands on the right game every week: Sept. 14 moves to Tomball, Sept. 21 to Magnolia West, Sept. 28 to Klein Collins, Oct. 5 to Klein, Oct. 12 to Klein Oak, Oct. 19 to Tomball Memorial, Oct. 26 to Magnolia, Nov. 2 to Klein Forest, and after the last game it stays there rather than falling off the end.

Two invariants keep it honest. The validator fails if any scheduled game has no edition, so the season cannot quietly stop producing pages. And it fails if a game before kickoff has no prediction from any source.

What automation still does not write is analysis. A generated edition has no players to watch, no keys and no recruiting notes, and its opening paragraph says only what is known and what updates later. Those sections stay empty until the editor (Sylvan) fills them, because filling them automatically means inventing them. When player capsules are added, record both teams' MaxPreps statistics pages, source update timestamps and games covered in `playerStatsAudit`; for the current preview the audit must fall within two days of kickoff or validation stops the build. Search the opponent roster as a whole for recruiting status before choosing capsules. Record the source and check date in `opponentRecruitingAudit`; every verified college commit must be a Player to watch and must name the college prominently. Also record every source-specific top-10 position or top-100 national prospect. Their capsule must lead with that distinction and explain why the player matters using verified production, honors, offer count and any materially relevant, sourced football pedigree. Keep each ranking attached to its source and never confuse offers, interest or predictions with a commitment.

## Advancing the season

`scripts/promote-edition.mjs` decides which edition the home page shows. The rule: the latest played game keeps the home page until the Monday of the next game's week; the next Preview then takes over. `scripts/lib/season.mjs` holds the rule and is unit tested for long open weeks, promotion Monday, game day, the end of the season and even consecutive-day games, where today's live game must not be displaced by tomorrow's preview.

The script also does two things that used to be manual and easy to forget:

- It rewrites `public/live-score.json` so its slug follows the current edition. The Next Game card reads that file to know which game to poll. Before this existed, a game night would have collected the score into KV while the home page still showed the previous week's final.
- It captures a verified `finalScore` once a game has been played, so a game keeps showing its result after it stops being current, without waiting for an authored recap.

`PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a handover or corrects one by hand.

## Automated facts

`scripts/refresh-facts.mjs` refreshes editions from public sources on a schedule. No language model runs in it. On an edition it may write `home.record`, `away.record`, both team ranks, `rankings`, `prediction`, `rating` and `weather`. `promote-edition.mjs` owns `finalScore`, `stats` and `gameStats`. The refresh also writes results, opponent records and the district standings table to `content/season-data.json`. Copy, preview players, headlines, sources and metadata stay editorial and are never touched by automation.

Sources, all free and unauthenticated:

- **Records** come from the District 15-6A standings table on the school's own Dave Campbell's team page, which is server rendered. One request covers every district opponent. Teams are matched on the exact string `"<name> <mascot>"` so `Klein` cannot match `Klein Cain`.
- **District standings** on the program page and every game report are that same table. `parseDistrictStandings` keeps the source order, district record, overall record and next opponent. `refresh-facts.mjs` stores them on `content/season-data.json` under `standings`. A failed parse leaves the previous table in place. The page shortens each name by the longest matching schedule or school name, so Klein stays distinct from Klein Cain. The next-opponent column is hidden on a phone.
- **The model prediction** comes from the `pick` field of the same Dave Campbell's scores endpoint the live score already uses: `POST /api/schools/scoresGetJson` with the game date, then the row matching the school and opponent. It is shown on the page as **Model Prediction** and is deliberately **not hyperlinked**, because the field is not rendered on any public Dave Campbell's page. Their scores UI shows only status, teams and scores, and their own markup for a game omits it; it appears to feed the Pick'Em contest instead. Linking it would send a reader somewhere the number is not shown. It is a signed margin from Klein Cain's point of view. Verified across 2,236 completed games rather than assumed: 1,216 paired rows are exact negatives with no exceptions, which rules out a poll or a count, and the sign predicts the winner 71.0 percent of the time. The median absolute pick is 11 and the range is -71 to 71, a plausible margin scale.
- **Our rating** is computed in `scripts/lib/rating.mjs` from every Texas result so far, roughly 1,300 games across 1,435 teams by early September. It is the classic Massey least-squares method, which is public: assert `rating(winner) - rating(loser) = margin` for every game and solve the overdetermined system. It is **not** the rating published on masseyratings.com, which is a refined proprietary system, and the validator rejects any attempt to attribute it to Massey. Two modelling choices are ours rather than derived from data: margins are capped at 28 so running up the score earns nothing, and a ridge term keeps the system solvable while the game graph is still in disconnected pieces. Home advantage is measured from the data, not assumed. Nothing is published until both teams have at least four games, so early in a season it correctly shows nothing.
- **Statewide rank** comes from Dave Campbell's weekly "Computer Rankings for All 1,500 TXHSFB Teams" article. Team pages link the recent ones, so `findRankingsArticle` picks the newest by the date in its URL rather than guessing a slug, and the parser refuses anything yielding fewer than 500 teams. This is where the original `Cain 132 · Tomball 69` came from: the numbers were right when written and then froze. As of the Week 2 article they are Cain 81 and Tomball 43, which is exactly why they are now refreshed rather than typed in. The `NR` on a team page is the separate AP-style poll, not this ranking.
- **Our own results** and the season record come from the same scan: `content/season-data.json` holds a result per game date, so the schedule and the record can no longer be hand-typed or drift from the opponent records beside them. `config/season-2026.json` no longer carries a `result` field.
- **Opponent records** in the schedule are computed from the same complete season scan the rating uses, so they cost no extra requests, and are written to `content/season-data.json` alongside our own results, rather than into the hand-maintained schedule. Teams are matched on Dave Campbell's exact school name; `config/season-2026.json` carries a `dctfName` where it differs, which today is Oak Ridge, listed there as "Conroe Oak Ridge". Exact matching matters: the feed also contains "Arlington Oakridge", and a substring match on "Klein" would hit five different schools. As a cross-check, all eight district opponents agree exactly with the standings table, which is a separate source.
- **Weather** comes from the National Weather Service (`api.weather.gov`), which needs no key. The hourly feed reaches about six days ahead, so a game further out gets no weather rather than an invented one. A forecast older than three days is dropped at build time instead of shown.

Predictions follow a fixed order of preference: our own rating first, then Massey, then the Dave Campbell's pick. `predictionFact` picks the best available and labels the fact with the source, so a reader always knows whose number they are seeing, and the validator fails the build if a game before kickoff has none at all. The `massey` field exists and is always null today, for the reason below; the slot keeps the preference order explicit so it can be filled the day a permitted route appears.

Massey is deliberately not a source. `masseyratings.com` answers automated requests with a Cloudflare bot challenge, and its `robots.txt` disallows `/data/` and `/scores.php`. Getting around either would be bot-detection bypass, so the Dave Campbell's pick replaces it. The Massey numbers on the Week 2 page stay as authored editorial text.

`.github/workflows/refresh-facts.yml` promotes and then refreshes at 6 AM Central daily, every three hours on Thursday and Friday when the forecast matters, and at 9 AM, noon and 3 PM Central on Saturday while Friday game statistics are usually being posted. The repository is public, so Actions minutes are free. Each run validates before committing, pushes to `main`, and Cloudflare rebuilds. Every automated fact change is a reviewable diff in git history. None of this requires a local computer to be running.

The rating is all-or-nothing. A statewide scores response is around a megabyte and timed out from GitHub's runners on the first cloud run, which produced a rating from 758 of 1,315 games without stopping anything. Requests now allow 60 seconds and retry three times, and if any date is still unavailable the rating is skipped entirely rather than computed from a partial season.

Failure is quiet by design. A source that is down, changes shape or does not match the scheduled game is reported in the job log and the previous verified value is kept. The job does not fail the build, and nothing unverified reaches the page.

`npm run refresh` runs it locally; `node scripts/refresh-facts.mjs --dry-run` reports what would change without writing.

One publishing limit remains: `.github/workflows/deploy.yml` ignores `content/**`, so a fact-only commit refreshes Cloudflare but not the GitHub Pages fallback. The `NR` shown on Dave Campbell's team pages is a different poll from the statewide computer ranking used by this site.

One parsing trap worth remembering: the scores feed reports every game twice, once from each school, and **the two rows carry different game ids**. Keying on `gameId` silently double-counts every game, which is caught by a test in `scripts/lib/rating.test.mjs`. The stable key is the date plus the sorted team pair.

## Season statistics

Once a played game is reflected in the source, `promote-edition.mjs` snapshots MaxPreps season stat leaders into that edition and the Final view renders them: 31 leaders across 13 categories as of the Week 2 game, covering passing, rushing, receiving, tackles, sacks, interceptions, turnovers, completion percentage and QB rating.

The source is the team stats page, which ships its data as a `__NEXT_DATA__` JSON block, so `parseStatLeaders` reads structured values rather than scraping rendered markup. MaxPreps `robots.txt` disallows `/school/`, `/team/`, `/scores/` and a long list of minor sports, but not this path; checked with a robots parser rather than by eye. There is no bot challenge.

Game-specific statistics are separate from the season snapshot. `promote-edition.mjs` finds the historical matchup through the MaxPreps schedule, opens that game's Stats tab, and reads the covered team's structured App Router data. Once MaxPreps reports a source update after the game date, the Final view receives a Player of the Game, up to six compact team totals, and category leaders for passing, rushing, receiving, tackles and kicking. A null team block means the coaches have not posted statistics; it never becomes a page of zeroes. The job retries for three days after capture so a corrected upload can replace the first one.

### Player of the Game model

`scripts/lib/player-of-game.mjs` owns the deterministic `Cain Impact v1` selection. It considers only Klein Cain's verified, game-only MaxPreps rows. Season totals, opponent statistics and recruiting ratings never enter the choice. The weights are 0.04 per passing yard, 4 per passing touchdown, minus 2 per interception thrown, 0.1 per rushing or receiving yard, 6 per rushing or receiving touchdown, 0.75 per tackle, 1.5 per tackle for loss, 3 per sack, 5 per defensive interception, 4 per forced fumble or recovery, and 0.8 per kicking point. Ties break on touchdowns, scrimmage yards, tackles, then jersey number.

The same Saturday retries that collect Friday game statistics make the selection, usually the morning after the game. Thursday games are covered by Friday's three-hour refreshes. When MaxPreps corrects a box score during the three-day retry window, the model runs again and can change the choice. The model name and implementation details stay internal; the public block shows only the player and the supporting stat line. The statistics immediately below link to the source box score. No language model or paid API is involved.

Three rules protect the season snapshot.

- **It never claims to be a box score.** These are season-to-date totals, and the heading says "Season totals, not this game alone" with the date the source entered them. The game-specific section is separately labeled and links directly to its MaxPreps box score.
- **It never backfills.** MaxPreps serves current totals with no history, so only the most recently played game may take a snapshot. Backfilling Week 1 would describe it with statistics from games played after it, which the first run did until this rule was added.
- **It never snapshots too early.** The source enters a Friday game the following morning, so a snapshot is taken only when the source's own `lastUpdated` date is after the game date. Otherwise the job says so and tries again the next day.

Every failure mode is covered by tests in `scripts/lib/stats.test.mjs`: a missing data block, malformed JSON, an empty leader list, rows missing a name or value, and missing freshness information all raise rather than publish a thin or silent result. A zero is kept, because zero is a real statistic.

## The postgame recap

`scripts/lib/recap.mjs` composes the `final` section once a game has a captured score, and `promote-edition.mjs` applies it. No language model is involved. Every sentence restates something already verified: the score, the venue and date, the season record derived from captured results, and how the published prediction compared. It also rewrites the page and share titles, because a page still titled "Preview" after kickoff is wrong.

It deliberately produces no unverified player claims. Verified game leaders come from the separate MaxPreps game-statistics capture; the pregame players to watch are never presented as though they performed.

An authored recap is never overwritten: the composer only fills a `final` section that is null. Rehearsed end to end at `PROMOTE_TODAY=2026-09-19` with a stubbed score, which produced the Final tab as the default view with the original preview preserved in its own tab.

Optional `recapNotes` hold postgame editorial commentary and sideline color — coach quotes, sideline context, turning points, or observations from the stands. When supplied, these notes are woven directly into the recap narrative (`final.body`) as editorial paragraphs in a journalistic, NY Times / Athletic style. They are never published as an isolated section titled "Extra".

A richer written recap is editorial, authored by Sylvan under the site's verification standards: every claim checked against a named source, every statistic traceable to a box score or published source, and never implying a pregame player performed well without verified postgame statistics. The deterministic recap exists so that a game night never ends with the site showing a stale preview; an authored recap is never overwritten.

## Editorial model

Sylvan is the site's full-time editor/manager, appointed with full publishing authority and responsibility for everything the automation does not write: photo selection, captions and photographer credit; editorial quality across every page; and all analysis and narrative — player capsules, keys, recruiting notes and game recaps. The deterministic pipeline still owns the machine fields (`home.record`, `away.record`, ranks, `prediction`, `rating`, `weather`, `finalScore`, `stats`, `gameStats`) and never writes editorial fields; conversely the editor never writes machine fields by hand.

The house rules stand regardless of who writes the copy: never invent player statistics, recruiting status, rankings, star ratings, records, results or postgame performance; never imply a pregame player performed well without verified postgame statistics; match team names exactly against source feed names; resolve identities through `content/roster-2026.json`; verify leadership against `config/coaches.json` and `config/publication.json`; store assets locally. A preview with player capsules must carry a team-by-team statistics audit completed within two days of kickoff, and a full opponent-player section must carry a dated, roster-wide recruiting audit naming every verified college commit and every source-specific top-10 position or top-100 national prospect.

## Open items

- Week 3 (Tomball, September 18) was played and Klein Cain won 55–38 on homecoming night. The report at `/games/week-3` features an authored final recap, game statistics, Player of the Game (Maxwell 'Max' Hendricks), and a 38-frame photo gallery.
- Week 4 (Magnolia West, September 25) player statistics were rechecked against both MaxPreps team pages September 23; the published values and source update times had not changed. Klein Cain's capsules cover its three completed games; Magnolia West's cover all four. The opponent recruiting audit was completed September 20, with commit status and prospect distinctions verified.
- Weeks 5 to 10 are generated starter pages: real facts, no player capsules or keys. They stay that way until the editor writes them.
- The opponent's season leaders could sit alongside ours; `fetchStatLeaders` works against any MaxPreps team stats URL.
- `.github/workflows/deploy.yml` ignores `content/**`, so a facts-only commit refreshes Cloudflare but not the GitHub Pages fallback.
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
- **Asset sync is setup, not recurring automation.** The facts workflow does not run `npm run roster`, `npm run photos` or `npm run logos`. Add an exact opponent profile and run the logo sync before a new edition can pass validation; refresh the roster and portraits manually when MaxPreps changes.
- **Homepage hero readability is a gradient problem, not a shrink-the-photo problem.** The Next Game feature photo should stay large and editorial. Solve hard edges and text contrast with crop, `object-position`, and a left-to-right black edge gradient over the image — not by anchoring a small corner sticker or lowering opacity until the subject disappears. Swap the asset through `publication.heroNextGameImage`; keep the file local under `public/`.

## Recovery and future schools

Revert a bad source commit and redeploy to recover the site. Preserve GitHub Pages during migration. Cloudflare has Worker logs, deployment history, cron failures and KV data; GitHub Actions has build logs. KV is separate from the repository, so export it before deleting its namespace or changing accounts.

If the source fails, keep the last timestamped score or use an authenticated correction. Do not label stale data as current.

To add a school, add its configuration, hostname, schedule and sources, then make content selection depend on the school. Partition scores by school and game. The current Worker accepts only Klein Cain; adding DNS alone will not create another site. Review quotas and data rights before expanding.

## Design decisions

The visual reference is Apple Sports and Yahoo Sports: compact, useful, information first. Sans-serif throughout, no serif faces, no oversized mastheads, no decorative eyebrow labels, no generic sports hype. Lead with the matchup, records, game facts and players to watch.

- Every band on the page aligns to one column, through the `--pad` custom property. Do not reintroduce `4vw` padding or per-section containers; they drifted apart at wide widths.
- The homepage Next Game module is one premium editorial card: photographic hero + integrated matchup strip. Do not split it back into a separate dark score dashboard under the hero; do not duplicate date, kickoff, district or a second preview CTA in the strip.
- Player reports are compact. On a phone each shows two clamped lines and expands in place, one at a time.
- After a game the final view is the default and the original preview stays in its own tab.
- The roster in small type and the team photo live on the program page, not on each game report.
- Colour reinforces meaning, never carries it alone: the W or L is always written out, and the school is purple with the opponent in red, matching the player cards.
- Links stay clean, without decorative arrows, and every interactive element has a visible focus state.
- Long-form editorial copy (`preview.intro.body`, `final.body`) uses blank lines for paragraph breaks and `**bold**` for key facts, per the convention in `content/editions/TEMPLATE.md`. Short paragraphs, bold used sparingly.
- Test desktop and mobile before publishing.
