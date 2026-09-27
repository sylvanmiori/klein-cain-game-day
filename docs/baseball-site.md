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
| `/` | `/baseball` | Home — weekend card, record strip |
| `/schedule` | `/baseball/schedule` | Tournament list + live bracket |
| `/standings` | `/baseball/standings` | Live pool standings |
| `/roster` | `/baseball/roster` | Roster |
| `/stats` | `/baseball/stats` | Season stats + Game Box Scores list (D1 `413baseball-stats`) |
| `/box-score?game=` | `/baseball/box-score` | Individual game batting/pitching (public) |
| `/submit` | `/baseball/submit` | Password-gated box-score entry |

### Box-score photo formats (HEIC)

Parents on iPhone often pick **HEIC/HEIF** from Photos. Workers AI vision does not reliably accept raw `image/heic`, so the submit UI (`components/baseball/boxscore-submit.tsx` + `heic-to-jpeg.ts`) **auto-converts HEIC/HEIF to JPEG in the browser** before `POST /api/baseball/boxscore`. On **Safari**, `heic2any` runs **first** (native HEIC decode can “succeed” with blank/odd JPEGs); elsewhere native decode runs first, then heic2any. JPEG/PNG/WebP are unchanged. The Worker returns `415` if a raw HEIC still arrives (stale client). Vision model is `@cf/meta/llama-4-scout-17b-16e-instruct` (see [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md)).

## Data and automation (summary)

- Schedule: `npm run baseball:schedule` → `content/baseball/schedule.json` (also Thursday GH Action).
- Bracket file: `npm run baseball:bracket` / Saturday–Sunday GH Action → `content/baseball/bracket.json`.
- Live bracket: Worker cron `*/15` → KV → `GET /api/baseball/bracket` (see [bracket poller](baseball-bracket-poller.md)).
- Live pool standings: same `*/15` cron → KV → `GET /api/baseball/standings` (see [standings poller](baseball-standings-poller.md)); Standings nav page at `/baseball/standings`.
- Stats: D1 + `/api/baseball/stats` (see [D1 doc](baseball-d1.md)); D1 is bound. Uploads still need `BOXSCORE_PASSWORD` on the Worker or Analyze returns `503 uploads not configured`.
- After a confirm, unique D1 results surface on Home/Schedule via `LiveGameResult` and on `/stats` / `/box-score?game=` (see [boxscore handoff](413-BOXSCORE-UPLOAD-HANDOFF.md)).

## Checklist before shipping a baseball UI change

1. Baseball-only files touched (no football bleed).
2. `npm run build:cloudflare` then `npm run deploy:cloudflare`.
3. Mobile (~390px) and desktop pass on `https://413baseball.gameday.report/`.
4. OG curl check if metadata or brand assets changed.
5. Venue still shows address + Open in Maps when `event_address` exists.
6. Update this doc (and PROJECT-GUIDE pointer) when behavior or traps change.
