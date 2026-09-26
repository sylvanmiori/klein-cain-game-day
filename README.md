# Game Day Report: Klein Cain

A football site with a program page, one report per game, live scores and season statistics. No subscription or email service is configured.

Start with [AGENTS.md](AGENTS.md) when handing the repository to an AI developer, then read the [project guide](docs/PROJECT-GUIDE.md) for architecture, accounts, sources, automation, recovery and open work. Its **Traps worth knowing** section records the non-obvious failures already solved.

The approved purple-helmet avatar is the site's visual identity. Its master file is `public/brand/cain-helmet-avatar-source.png`; `npm run brand:assets` regenerates the favicon set, Apple/Android touch icons, homepage helmet images and fallback social-share card. The earlier [social kit](brand/social-2026/README.md) is archived and should not be used as the current logo.

Standalone launch graphics are available as public files at `/launch/gameday-report-wide-1920x1080.png`, `/launch/gameday-report-square-1080x1080.png` and `/launch/gameday-report-vertical-1080x1920.png`. They are available by direct URL but are not displayed in site pages. The device screens are illustrative mockups showing the Week 4 matchup, so review their time-specific details before sharing later in the season.

## Status

Live at https://kleincain.gameday.report/. https://gameday.report/ redirects there while Klein Cain is the only school. GitHub Pages remains a migration fallback.

`/` is the Klein Cain program homepage: season record (3–0), one unified Next Game card (preview CTA, live score polling and matchup strip), a unified Latest Recap feature card (recap narrative, lead game photography with caption, Player of the Game spotlight and gallery link), schedule, district standings, season leaders, head coach bio, roster and paths to every game report. Game photography lives in `content/galleries/` and on `/photos`, featuring an accessible `<dialog>` lightbox with keyboard navigation and elevated photographer bylines. Video highlights live under `public/videos/` and embed in game reports via `components/game-video.tsx`. Each game keeps its own page at `/games/week-<n>`. Promotion still sets which game the Next Game card follows; full preview and recap copy are never embedded on `/`.

Between games, the homepage features the latest final recap card. On the first scheduled automation run on the Monday of the next game's week, the Next Game card switches to that game's preview (currently Week 4 at Magnolia West); game day therefore always opens on the current matchup.

The in-season data pipeline runs unattended in GitHub Actions for deterministic facts. A scheduled workflow creates missing editions, promotes the current game, refreshes facts from public sources (scores, records, district standings, ranks, predictions, weather) and writes a postgame recap.

The same repository also hosts **413baseball.gameday.report**, a separate site for the owner's 15U travel baseball team (4:13 Baseball, Spring TX). It has its own routes under `/baseball` (home, schedule, roster, stats, box-score upload), its own Perfect Game schedule scraper (Thursday automation) and bracket check (Saturday 11pm CT with hourly retries), and a D1-backed stats API fed only by manual box-score screenshot uploads. The box-score area is password-gated: the one-word password lives only in the Cloudflare Dashboard (Worker → Settings → Variables and Secrets, `BOXSCORE_PASSWORD`) and is never committed — see `cloudflare/.dev.vars.example` for local dev. See the "413baseball.gameday.report (4:13 Baseball)" section of docs/PROJECT-GUIDE.md. All baseball code is isolated from the football site.

Sylvan, the appointed full-time editor/manager of the site, writes all analysis and editorial — players to watch, keys, recruiting notes and narrative — under the same source-integrity and fact-verification standards: never invent or infer scores, statistics, records, rankings, recruiting information or player performance; match team names exactly against source feed names; resolve player identities through `content/roster-2026.json`; verify head coaches against `config/coaches.json`. A current preview with player capsules must include a team-by-team statistics audit completed within two days of kickoff. A full opponent-player section must also include a dated, roster-wide recruiting audit; every verified college commit and every source-specific top-10 position or top-100 national prospect found in that audit is required in Players to watch.

New schedule opponents require one setup pass: add their exact MaxPreps profile to `config/opponent-logos.json` and run `npm run logos`. Player portraits are refreshed manually with `npm run photos`. The varsity roster is refreshed from MaxPreps with `npm run roster`. Neither asset import runs on the recurring facts workflow.

## Development

Node 24 is used in CI and recommended locally; the declared minimum is Node 22.13. Run `npm ci`, then `npm run dev`.

- `npm run editions` creates a starter edition for any scheduled game that lacks one.
- `npm run promote` sets which edition is current, captures final scores and season statistics, and writes the recap.
- `npm run postgame` is the manual alias for promotion, game statistics and Player of the Game capture.
- `npm run refresh` updates records, ranks, the published prediction, our rating, the forecast and our own results.
- `npm run photos` stores available Klein Cain roster portraits locally and maps them by player identity.
- `npm run roster` refreshes the varsity roster from MaxPreps and keeps existing local portraits by name.
- `npm run logos` stores every configured opponent logo locally and updates its edition.
- `npm run brand:assets` regenerates all site identity assets from the approved helmet image.
- `npm run validate` checks every edition against the schedule and the editorial rules.
- `npm run sitemap` generates the XML sitemap with last significant change dates from Git history; it omits dates when provenance is unavailable.
- `npm run docs:check` verifies documented paths and npm commands still exist.
- `npm run test:score` tests the Worker, score parser, rating, recap, promotion rule and stats parser.
- `npm run build:cloudflare` validates, builds root-relative assets, then checks the built pages for stale opponents.
- `npm run deploy:cloudflare` deploys the site and score Worker.

`node scripts/refresh-facts.mjs --dry-run` and `node scripts/promote-edition.mjs --dry-run` report without writing. `PROMOTE_TODAY=2026-09-18 npm run promote` rehearses a given day.

## Search visibility

The school subdomain is the canonical URL. The homepage and ten game reports are crawlable, linked internally and listed in `public/sitemap.xml`; the sitemap is declared in `public/robots.txt`. `components/seo-schema.tsx` identifies Cain Game Day as the independent publication and Klein Cain as the team it covers. The sitemap's `lastmod` reflects a relevant Git commit rather than the time of each build. On September 23, 2026, the owner confirmed that Google Search Console verification and sitemap submission are done (not independently inspected from this repository). Organic search performance should now be measured there by query and page, not inferred from a single personalized results page.
