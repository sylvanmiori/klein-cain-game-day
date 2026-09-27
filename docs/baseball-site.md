# 4:13 Baseball site guide

Shared reference for anyone working on **413baseball.gameday.report** (4:13 Baseball, 15U travel, Spring TX). The team is Steven Morris’s; Steven Miori hosts the site as a favor. **It is not Klein Cain football** and must never share football branding, copy, or Open Graph tags.

For deep dives: [Perfect Game coverage](baseball-pg-coverage.md), [brackets](baseball-brackets.md), [bracket poller](baseball-bracket-poller.md), [standings poller](baseball-standings-poller.md), [D1 / box scores](baseball-d1.md), [box-score upload / vision handoff](413-BOXSCORE-UPLOAD-HANDOFF.md). Architecture overview also lives in [PROJECT-GUIDE.md](PROJECT-GUIDE.md#413baseballgamedayreport-413-baseball).

## Isolation (non-negotiable)

- Code lives only under `app/baseball/`, `components/baseball/`, `content/baseball/`, `scripts/baseball-*.mjs`, `cloudflare/baseball-*`, and `docs/baseball-*.md`.
- Do not mix football schedule, roster, scores, photos, or OG assets into baseball pages.
- Never invent scores, seeds, standings, or box-score lines. Schedule/bracket facts come from Perfect Game parses; player stats come only from owner-uploaded box scores.

## Live publish path

Live `413baseball.gameday.report` is the **Cloudflare Worker** `gameday-report` (same Worker as football, separate custom domain).

```bash
npm run build:cloudflare
npm run deploy:cloudflare
```

GitHub Actions “Publish website” that targets GitHub Pages is **not** sufficient for this host. After UI or metadata changes, deploy Cloudflare and hard-refresh (or cache-bust with `?v=…`) before judging live.

Worker hostname rewrite (`cloudflare/worker.mjs`): on `413baseball.gameday.report`, `/` becomes `/baseball`, and other non-asset paths are prefixed with `/baseball`. Static assets (`/_next/*`, `/brand/*`, etc.) are not rewritten.

## Branding and link previews (Open Graph)

Football root metadata in `app/layout.tsx` defaults every page to Klein Cain football OG tags. Baseball **must override** `openGraph` and `twitter` in `app/baseball/layout.tsx` (and Home in `app/baseball/page.tsx`) with absolute `413baseball.gameday.report` URLs.

| Asset | Path |
| --- | --- |
| Shield PNGs | `public/brand/baseball/413-shield-{48,96,192,512}.png` |
| Full logo | `public/brand/baseball/413-shield-logo.png` |
| Social / iMessage preview | `public/brand/baseball/og.png` (1200×630) |
| Favicon / Apple | `app/baseball/icon.png`, `app/baseball/apple-icon.png` |

Colors: navy `#12324e`, Carolina blue `#7BAFD4`, page wash `#f5f7fa`.

**Trap:** if baseball layout only sets `title` / `description`, crawlers (iMessage, Slack, Facebook) still show the football helmet preview. Always set `og:title`, `og:description`, `og:url`, `og:site_name`, `og:image`, and matching Twitter fields. iMessage caches previews aggressively — a new share or `?v=` query is often required to refetch after a fix.

Verify after deploy:

```bash
curl -sL -A 'facebookexternalhit/1.1' 'https://413baseball.gameday.report/' \
  | grep -E 'og:(title|image|site_name|url)'
```

Expect `4:13 Baseball`, `413baseball.gameday.report`, and `/brand/baseball/og.png` — never `kleincain` or `/og.png` (football).

## Home UI (`app/baseball/page.tsx`)

Goals: parents can see **this weekend** at a glance — time, field, pool, opponent, status — on a phone without nested “card inside card” chrome.

- One white card for This Weekend (single outer border). Hairline dividers between games only; no tinted nested footer box.
- Compact mobile rows: date chip left; **time + field/pool on one line**; opponent + Upcoming/result on the next.
- Result chips use `<LiveGameResult>`: checked-in `schedule.json` `result` when present, otherwise a unique D1 match from `GET /api/baseball/stats` (opponent aliases allowed; ambiguous doubleheaders stay blank). Saved matches link to `/box-score?game=<id>` with `!text-white` on the navy pill.
- **Sunday bracket path** (`components/baseball/home-bracket-path.tsx`): client-fetches `GET /api/baseball/bracket` (same as Schedule `<BracketLive>`). When at least one bracket game includes a **named** `4:13 Baseball` team (match by name / contains `4:13`, not pool seed; ignore `Seed #N` placeholders), Home shows a navy-branded section above This Weekend — title like “Sunday · Silver Bracket”, next game (time/field/opponent/home-away), compact QF→SF→Championship path (feeders stay “Winner of Game #N” until PG fills names), links to Schedule + Perfect Game bracket URL, and “Updated … · Source: Perfect Game”. On API 404/fail the section hides — never invents scores/seeds. **No `schedule.json` redeploy required** for this Sunday section.
- Active Home nav pill: navy fill `#12324e` with **white** text (inline color / `!text-white` beats global `a { color: inherit }`). On the 413 host, Home href is `/` and `/` counts as active (`components/baseball/baseball-subnav.tsx`).
- Prefer tight mobile gutters (`pl-3` / `pr-3`, wider from `sm:`) so content uses the screen width.
- Season Record empty state: baseball mark + two-line copy (`components/baseball/record-strip.tsx`); record strip shares `loadLiveStats()` with result pills.

Reference mockup: `docs/413-home-ui-mockup.png` (also kept under UI QA scratch when testing).

## Venue address and Maps

Perfect Game scrapes include `event_address` (street address). `loadSchedule()` maps it to `ScheduleTournament.address` (`components/baseball/data.ts`).

Home and Schedule render venue name + street address and wrap them in `mapsSearchUrl(...)` → `https://maps.google.com/?q=…` so parents can open Maps from a phone in one tap. Prefer `mapsSearchUrl(venue, address)` when address is present (do not also append city if the address already includes it).

If a tournament lacks `event_address`, fall back to venue + city; still link when a useful query string exists.

## Routes

| Public URL (413 host) | App route | Purpose |
| --- | --- | --- |
| `/` | `/baseball` | Home — weekend card, live Sunday bracket path, record strip |
| `/schedule` | `/baseball/schedule` | Tournament list + live bracket |
| `/standings` | `/baseball/standings` | Live pool standings |
| `/roster` | `/baseball/roster` | Roster |
| `/stats` | `/baseball/stats` | Season stats + Game Box Scores list (D1 `413baseball-stats`) |
| `/box-score?game=` | `/baseball/box-score` | Individual game batting/pitching (public) |
| `/player?id=` | `/baseball/player` | Individual player page — hero + Summary/Game Log/Stats tabs (public) |
| `/submit` | `/baseball/submit` | Password-gated box-score entry |

### Player pages and name links

Individual player season pages live at `/baseball/player?id=<player_id>` (query style, same pattern as `/box-score?game=`). Optional `?tab=summary|gamelog|stats` deep-links the active section (default Summary). Data comes from public `GET /api/baseball/players/:id` (same season formulas as `/api/baseball/stats`, plus a game log).

Layout (Yahoo Sports **structure**, 4:13 brand — navy `#12324e`, light cards; no purple theme, no fake headshots):

1. **Hero** — large name, `#jersey POSITION` (+ quiet grad year), small 413 shield, season year badge, key stat strip (hitters: AVG·HR·RBI·R or AVG·H·RBI·OPS when HR is 0; pitchers-only: ERA·IP·K·WHIP; both: batting primary + small pitching secondary).
2. **Sticky tabs** — Summary | Game Log | Stats (skip Splits/News/Bio).
3. **Summary** — compact Last Games table (opponent → box-score) + season snapshot rows.
4. **Game Log** — full game-by-game batting/pitching from `games[]`.
5. **Stats** — full season batting (+ pitching when present).

Roster player names on `/stats`, `/box-score`, and `/roster` link through `PlayerNameLink` — same body text color, no default underline; hover underline + focus-visible ring. Opponent names and missing `player_id` stay plain text. Submit/edit grids intentionally do not link names (edit UX).

### Box-score photo formats (HEIC)

Parents on iPhone often pick **HEIC/HEIF** from Photos. Workers AI vision does not reliably accept raw `image/heic`, so the submit UI (`components/baseball/boxscore-submit.tsx` + `heic-to-jpeg.ts`) **auto-converts HEIC/HEIF to JPEG in the browser** before `POST /api/baseball/boxscore`. On **Safari**, `heic2any` runs **first** (native HEIC decode can “succeed” with blank/odd JPEGs); elsewhere native decode runs first, then heic2any. JPEG/PNG/WebP are unchanged. The Worker returns `415` if a raw HEIC still arrives (stale client). Vision model is `@cf/meta/llama-4-scout-17b-16e-instruct` (see [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md)).

## Data and automation (summary)

- Schedule (build-time): `npm run baseball:schedule` → `content/baseball/schedule.json` (Thursday GH Action). Powers Home "This Weekend" and the Schedule **tournament game list**.
- Bracket file (build-time fallback only): `npm run baseball:bracket` / GH Action `baseball-bracket.yml` (hourly Sat 11pm–Sun noon CT) → `content/baseball/bracket.json`.
- Live bracket: Worker cron `*/15` → KV `baseball:bracket:<event_id>` → `GET /api/baseball/bracket` → Schedule `<BracketLive>` **and** Home `<HomeBracketPath>` (see [bracket poller](baseball-bracket-poller.md)). No deploy when PG fills seeds/scores; Home Sunday path needs no `schedule.json` refresh.
- Live pool standings: same `*/15` cron (independent try/catch) → KV `baseball:standings:<event_id>` → `GET /api/baseball/standings` → `/standings` via `<StandingsLive>` (see [standings poller](baseball-standings-poller.md)). No deploy when PG updates W-L/seeds. SSR may show stale build-time fallback until client hydrates.
- Wrangler crons: `* * * * *` = football score ingest only; `*/15 * * * *` = both baseball pollers. Chicago gate: Sat/Sun 7:00am–11:00pm CT every 15-min tick; otherwise `:00` hourly only. Skip if no tournament covering today in bundled `schedule.json`. KV only (not R2); last-good only — never invent seeds/scores/teams.
- Stats / box scores: D1 + `/api/baseball/stats` and per-player `/api/baseball/players/:id` (see [D1 doc](baseball-d1.md)). Box-score upload (password / HEIC / Analyze) is a **separate** path from bracket/standings; see [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md) for vision residuals. After a confirm, unique D1 results surface on Home/Schedule via `LiveGameResult`.

## Weekend ops / Sunday readiness

Verified operating model for tournament weekends (e.g. event 140434, 2026 15U PG Backyard Brawl @ Premier). Prefer the **mechanism** over locking any provisional seed or Sunday opponent as permanent state.

| Surface | Source | Auto overnight? | Needs schedule refresh + Cloudflare deploy? |
| --- | --- | --- | --- |
| `/standings` pool tables | Worker KV via `/api/baseball/standings` | **Yes** — next successful poll after PG updates | No |
| Schedule `<BracketLive>` | Worker KV via `/api/baseball/bracket` | **Yes** — next poll after PG replaces `Seed #N` / fills scores | No |
| Home "This Weekend" cards (Sat pool list) | Build-time `content/baseball/schedule.json` | **No** | **Yes** — after PG lists new pool games on the team schedule |
| Home **Sunday bracket path** | Worker KV via `/api/baseball/bracket` (`<HomeBracketPath>`) | **Yes** — when PG names 4:13 on the bracket | **No** — no `schedule.json` redeploy for that section |
| Schedule tournament **game list** | Same `schedule.json` | **No** | **Yes** — same as Home |
| Build-time `bracket.json` | GH Action `baseball-bracket.yml` | Commits fallback only | Deploy only if you need that fallback baked into a new build; live path is KV |

**What Steven does not need to babysit tonight:** standings seed/W-L and bracket structure/seeds/scores once Perfect Game publishes them. The Worker pollers handle that without an agent in the loop and without a docs-or-data deploy.

**What still needs a human (or Thursday/manual scraper + deploy):** new **pool** games that appear only on the PG team schedule (still `schedule.json` + deploy). Sunday **bracket** opponent/time/path on Home comes from the live bracket API once Perfect Game names `4:13 Baseball` on a bracket game — no schedule.json redeploy for that section.

Point-in-time check (Sat Sep 26, 2026 ~10:15 PM CT): 4:13 named in Silver Bracket QF game #28 (Sun 10:20 AM Field 8 vs #6 Den Guys 15u); feeders SF #30 / Championship #31. Home Sunday path is wired to that live snapshot.

## Checklist before shipping a baseball UI change

1. Baseball-only files touched (no football bleed).
2. `npm run build:cloudflare` then `npm run deploy:cloudflare`.
3. Mobile (~390px) and desktop pass on `https://413baseball.gameday.report/`.
4. OG curl check if metadata or brand assets changed.
5. Venue still shows address + Open in Maps when `event_address` exists.
6. Update this doc (and PROJECT-GUIDE pointer) when behavior or traps change.
