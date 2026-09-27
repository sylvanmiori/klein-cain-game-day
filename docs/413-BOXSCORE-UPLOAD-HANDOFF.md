# 4:13 Baseball — Box Score Upload / Analyze Vision Pipeline Handoff

**Audience:** Codex Astra, Chief, GrokBot, or any engineer with zero prior context  
**Owner ask:** Steven Miori wants parents to upload iPhone GameChanger photos (including HEIC) and get a usable STEP 2 REVIEW — **not** Manual entry.  
**Originally written:** Sat Sep 26, 2026 ~7pm CT (pre-Codex HEAD `f9c6017`)  
**This refresh:** Sat Sep 26, 2026 ~8:15pm CT — post Codex Astra vision upgrade + schedule/box-score publish work  
**Repo HEAD at this refresh:** `c2378a7` — *Fix unreadable navy result pills on 413 Home* (Chief contrast fix on top of Codex)  
**Prior Codex chain (after handoff SHA `f9c6017`):** `0f3cb19` → `3f41ba4` → `54fa222` → `2d18704` → `27e1f2b` → then Chief `c2378a7`  
**Live host:** https://413baseball.gameday.report (Cloudflare Worker **only**)  
**Submit UI:** https://413baseball.gameday.report/submit  
**Individual box score:** https://413baseball.gameday.report/box-score?game=`<id>`  

**Do not invent stats. Do not print `BOXSCORE_PASSWORD`. Do not mix with Klein Cain football.**

Cross-links: [`docs/PROJECT-GUIDE.md`](PROJECT-GUIDE.md#413baseballgamedayreport-413-baseball) · [`docs/baseball-site.md`](baseball-site.md) · [`docs/baseball-d1.md`](baseball-d1.md) · [`docs/GROKBOT-RUNBOOK.md`](GROKBOT-RUNBOOK.md)

---

## Changelog since original handoff (`f9c6017`)

| SHA | Author | Title | What changed |
| --- | --- | --- | --- |
| `0f3cb19` | Codex / Steven | Baseball: upgrade box-score vision extraction | Switched Workers AI model from `@cf/meta/llama-3.2-11b-vision-instruct` → **`@cf/meta/llama-4-scout-17b-16e-instruct`**. Added `cloudflare/boxscore-worker.test.mjs` asserting that constant. Updated PROJECT-GUIDE model note. **No prompt rewrite** in this commit. |
| `3f41ba4` | Codex / Steven | Baseball: prevent mobile form field overlap | `GameMetaFields` in `boxscore-submit.tsx`: Date + Opponent are `col-span-2` on narrow screens (`sm:col-span-1`); all fields get `min-w-0` so inputs no longer collide. |
| `54fa222` | Codex / Steven | Sync saved baseball results to schedule | New `live-stats.ts` + `LiveGameResult` client widget. Home / Schedule pills load `GET /api/baseball/stats` and attach a saved D1 `result` when date + opponent match uniquely. Shared in-flight fetch with `record-strip`. Tests in `live-stats.test.ts`. |
| `2d18704` | Codex / Steven | Match saved baseball opponent aliases | `opponentsMatch()` allows substantial containment (≥8 normalized chars) so PG names like `15U OFFSEASON BASEBALL - WILLIAMS` match GameChanger `Offseason Baseball`. Still rejects ambiguous doubleheaders / multi-match. |
| `27e1f2b` | Codex / Steven | Publish individual baseball box scores | New `/baseball/box-score?game=` page (`game-box-score.tsx`) reading `GET /api/baseball/games/:id`. Stats page lists “Game Box Scores”. Result pills that resolve to a saved game become links to that page. `findSavedGame` returns the full `ApiGame`. |
| `c2378a7` | Chief | Fix unreadable navy result pills on 413 Home | Linked W/L chips use `!text-white` so global `a { color: inherit }` cannot turn score text navy-on-navy. |

---

## 1. Goal / product requirements

### What 4:13 Baseball is
- **4:13 Baseball** = Steven **Morris**’s 15U travel team (Spring, TX).
- Steven **Miori** hosts https://413baseball.gameday.report as a favor.
- It is **never** Klein Cain football. No shared branding, scores, OG tags, roster, or inventing football/baseball facts.

### What “Analyze” must do for parents
1. Parent opens `/submit`, enters the one-word upload password once (sessionStorage).
2. Picks one or two GameChanger box-score screenshots from iPhone Photos (**HEIC must work**).
3. Taps **Analyze** → client converts HEIC→JPEG → `POST /api/baseball/boxscore`.
4. Lands on **STEP 2 REVIEW** with editable batting/pitching grids that are **close enough to truth** that a parent can confirm (amber sum warnings OK; all-zeros / fake roster is not OK).
5. Parent edits if needed, taps Save → `POST /api/baseball/boxscore/confirm` writes D1.
6. After confirm, Home/Schedule can show the live result pill (and link into the individual box-score page when a unique D1 match exists).

### Hard product constraints (still in force)
| Constraint | Why |
| --- | --- |
| **Confirm UI is mandatory** | Never auto-save a bad extract. Analyze only returns JSON for review; Save is a separate confirm. |
| **Manual entry is NOT an acceptable product answer** | Steven refuses “just type it” as the fix for photo upload. Manual mode may remain as a power tool, but HEIC Analyze must work. |
| **Never invent scores/stats/players** | Only what is printed on the photo (plus D1 roster for fuzzy name expansion). |
| **No fat prompts that caused all-zeros** | Loop-2 (`a29aef0` / `3a88a82`) proved bloated completeness audits → all-zeros batting + roster dump. Prefer model swap / post-filters / D1 jerseys. |
| **Football minute cron untouched** | `* * * * *` football score ingest and `*/15 * * * *` baseball PG pollers must keep working. |
| **Live = Cloudflare Worker** | `npm run build:cloudflare` then `npm run deploy:cloudflare`. GitHub Pages does **not** update 413. Docs-only commits are fine without a special Worker redeploy unless `worker.mjs` / bindings changed. |

---

## 2. Current HEAD architecture (after Codex)

```
iPhone Photos (often HEIC/HEIF)
        │
        ▼
components/baseball/boxscore-submit.tsx  (UploadMode.handleAnalyze)
        │  prepareImagesForUpload()  →  components/baseball/heic-to-jpeg.ts
        │    Safari: heic2any FIRST, then native (preferHeic2AnyFirst)
        │    Else: native first, then heic2any
        │  FormData: password + images[] (+ optional game_date/opponent/game_id)
        ▼
POST /api/baseball/boxscore   (cloudflare/worker.mjs)
        │  passwordGate(env.BOXSCORE_PASSWORD)  — never log/echo secret
        │  reject raw HEIC → 415
        │  baseballRosterNames(D1) → prompt candidate list with (#NN) when known
        │  runBoxscoreVision( @cf/meta/llama-4-scout-17b-16e-instruct )   ← Codex 0f3cb19
        │       max_tokens 4096, temperature 0
        │       auto {prompt:'agree'} retry on Meta license 5016
        │  extractJsonObject(raw)  — brace-balanced
        │  boxscoreSumCheck → optional second-pass boxscoreAuditPrompt
        │  preferBoxscoreParse(first, audit)  — never prefer longer dump on tie
        │  map rows → display names + ints
        │  filterRosterDump(...)  — cloudflare/boxscore-filter.mjs
        ▼
JSON { game, batting, pitching, uncertain, sum_check, line_score, already_exists }
        │
        ▼
STEP 2 REVIEW UI (editable grids + amber totalWarnings; mobile GameMetaFields fixed)
        │  parent edits; Save only if they confirm
        ▼
POST /api/baseball/boxscore/confirm
        │  writeGameLines() → D1 BASEBALL_STATS (games + batting_lines + pitching_lines)
        ▼
GET /api/baseball/stats  → season tables on /stats
        │                 → LiveGameResult / BaseballRecordStrip on Home + Schedule
        │                 → “Game Box Scores” list on /stats
        ▼
GET /api/baseball/games/:id → /baseball/box-score?game=<id> (public read-only page)
```

### Auth model
- **Not** Bearer `/analyze`. Multipart form field `password` (and JSON `password` on confirm).
- Secret name: Cloudflare Worker secret **`BOXSCORE_PASSWORD`** (value never documented here).
- Missing secret → `503 {"error":"uploads not configured"}`.
- Wrong password → `401`; >10 failures / IP / 5 min → `429` (best-effort in-isolate map).

### Cron split (do not break)
From `cloudflare/wrangler.jsonc` triggers: `"* * * * *"` and `"*/15 * * * *"`.

In `worker.mjs` `scheduled()`:
- If `controller.cron === '*/15 * * * *'` → `pollBaseballBracket` + `pollBaseballPoolStandings` only.
- Else (minute cron) → **football** `fetchGameScore` / KV `SCORES` ingest.

### Schedule ↔ D1 result sync (new)
- `components/baseball/live-stats.ts`: shared `loadLiveStats()`, `normalizeOpponent()`, `opponentsMatch()`, `findSavedGame()` / `findSavedResult()`.
- Match rules: same calendar date + unique one-to-one opponent match (exact normalized OR substantial containment ≥8 chars). Reject date-only, blank results, duplicate saved games, and ambiguous same-day doubleheaders / multi-PG names that both contain the saved short name.
- `components/baseball/live-game-result.tsx`: client pill on Home (`style="home"`) and Schedule (`style="schedule"`). If a saved D1 game id is known, the pill is an `<a href="/baseball/box-score?game=…">` with `!text-white` (Chief `c2378a7`). Checked-in `schedule.json` `result` still wins as SSR fallback when present.

---

## 3. Key files & bindings

### Cloudflare Worker
| Path | Role |
| --- | --- |
| `cloudflare/worker.mjs` | passwordGate, vision prompt, HEIC 415, sum-check/audit, boxscore routes, standings/bracket cron, football cron; **`BOXSCORE_VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'`** |
| `cloudflare/boxscore-worker.test.mjs` | Asserts Scout model constant (Codex) |
| `cloudflare/boxscore-filter.mjs` | Post-parse roster-dump filter + `preferBoxscoreParse` |
| `cloudflare/boxscore-filter.test.mjs` | Unit tests for clone-row / filler strip |
| `cloudflare/wrangler.jsonc` | Bindings: `ASSETS`, `SCORES` (KV), `AI`, `BASEBALL_STATS` (D1 `413baseball-stats`) |
| `cloudflare/baseball-schema.sql` | `players`, `games`, `batting_lines`, `pitching_lines` |
| `scripts/baseball-seed.mjs` | Roster + photo-verified `jersey_number` UPDATEs |

### Client
| Path | Role |
| --- | --- |
| `components/baseball/boxscore-submit.tsx` | Password gate, Upload / Manual / Edit; mobile GameMetaFields overlap fix |
| `components/baseball/heic-to-jpeg.ts` | HEIC→JPEG; **Safari prefers heic2any first** |
| `components/baseball/heic-to-jpeg.test.ts` | Unit tests |
| `components/baseball/live-stats.ts` | Shared stats fetch + opponent alias matching |
| `components/baseball/live-stats.test.ts` | Alias / ambiguity tests |
| `components/baseball/live-game-result.tsx` | Home/Schedule result pills → optional box-score link |
| `components/baseball/game-box-score.tsx` | Public per-game batting/pitching tables |
| `app/baseball/box-score/page.tsx` | Route shell for individual box score |
| `components/baseball/stats-tables.tsx` | Season tables + Game Box Scores list |
| `components/baseball/types.ts` | Parsed line / API response types |

### Docs
- `docs/413-BOXSCORE-UPLOAD-HANDOFF.md` — this file (vision + publish ground truth)
- `docs/baseball-site.md` — isolation, deploy, routes, HEIC, live result pills
- `docs/baseball-d1.md` — D1 + API surface
- `docs/PROJECT-GUIDE.md` — broader architecture (§413 baseball)
- `docs/GROKBOT-RUNBOOK.md` — dual-AI publish rules

### Bindings (`cloudflare/wrangler.jsonc`)
```jsonc
"ai": { "binding": "AI" },
"d1_databases": [{
  "binding": "BASEBALL_STATS",
  "database_name": "413baseball-stats",
  "database_id": "8885adde-6929-40f8-906d-bef5479729cf"
}],
"kv_namespaces": [{ "binding": "SCORES", "id": "230ad4e9643a45b7b9e7a9a88ca3db6a" }],
"routes": [
  { "pattern": "gameday.report", "custom_domain": true },
  { "pattern": "kleincain.gameday.report", "custom_domain": true },
  { "pattern": "413baseball.gameday.report", "custom_domain": true }
]
```

Vision model constant (`cloudflare/worker.mjs`):
```js
const BOXSCORE_VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const BOXSCORE_MAX_TOKENS = 4096;
```

### Stat columns (UI / types)
**Batting (GameChanger LINEUP L→R):** `AB | R | H | RBI | BB | SO` → stored as `ab, r, h, rbi, bb, k` plus extras `1b,2b,3b,hr,sb,cs,hbp,sf,sac,e`.

**Pitching:** `IP | H | R | ER | BB | SO` → `ip, h, r, er, bb, k` plus `w,l,sv,hr,hbp,wp,bf,pitches,strikes`.

Display name from model: `first_initial` + `last_name` → e.g. `"L Morris"` (`lineDisplayName`).

---

## 4. How to run / deploy / test

### Deploy (413 live)
```bash
cd /Users/smiori/Developer/klein-cain-game-day
npm run build:cloudflare
npm run deploy:cloudflare
```
Worker name: `gameday-report`. After UI changes, hard-refresh `/submit` (or `?v=`). Pushes to `main` also auto-deploy via Workers Builds when that pipeline is healthy — still verify live after a Worker model change.

**Docs-only commits do not require a Worker redeploy.** Redeploy when `cloudflare/worker.mjs`, schema, bindings, or client assets that must ship with ASSETS change.

### Tests
```bash
npm run test:score
# includes:
#   cloudflare/*.test.mjs  (boxscore-filter + boxscore-worker model assert)
#   components/baseball/heic-to-jpeg.test.ts
#   components/baseball/live-stats.test.ts
```

### Live Analyze against production Worker (lab style)
Need the real `BOXSCORE_PASSWORD` (from Steven / Cloudflare secrets — **never commit it**).

```bash
curl -sS -X POST 'https://413baseball.gameday.report/api/baseball/boxscore' \
  -F "password=$BOXSCORE_PASSWORD" \
  -F "images[]=@/path/to/source.jpg;type=image/jpeg" \
  | jq '{game, sum_check, batting: [.batting[]|{player,jersey,ab,r,h,rbi,bb,k}], pitching}'

# Raw HEIC must 415:
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  'https://413baseball.gameday.report/api/baseball/boxscore' \
  -F "password=$BOXSCORE_PASSWORD" \
  -F "images[]=@/path/to/IMG.heic;type=image/heic"
# expect 415
```

### Local fixtures on the shared box (agent workspace)
| Path | Notes |
| --- | --- |
| `/workspace/.tmp-heic-compare/source.jpg` | Lab JPEG used for 3× retest after `f9c6017` |
| `/workspace/.tmp-heic-compare/source.heic` | Matching HEIC |
| `/workspace/.tmp-heic-compare/FILTER-RETEST-REPORT.json` | Post-filter 3× lab results (pre-Scout) |
| `/workspace/.tmp-heic-compare/FIX-REPORT.json` | Loop-1 digit/poison fix + **ground truth** |
| `/workspace/.tmp-heic-compare/LOOP2-REVERT-REPORT.json` | Why loop-2 was reverted |
| `/workspace/413-boxscore-sep26.jpg`, `413-from-heic.jpg`, `413-sep26.heic` | Alternate copies |
| Mac: `.tmp-verify/boxscore-sep26.{jpg,heic}`, `boxscore-from-heic.jpg` | Same game |

**Note:** As of this refresh there is **no** saved `/workspace/.tmp-heic-compare/*scout*` lab JSON proving a post-`0f3cb19` HEIC/JPEG retest. Codex’s PROJECT-GUIDE claim (Scout fixed zero-filled batting on the Sep 26 fixture) is recorded below under “what Codex fixed”; treat live HEIC re-verify as still required.

Repo: `/Users/smiori/Developer/klein-cain-game-day` → GitHub `sylvanmiori/klein-cain-game-day`.

---

## 5. Ground truth — Sat Sep 26, 2026 game

**Final:** **4:13 Baseball 15U 7, Texas Steel (TXSS/TSB) 5**, FINAL (`W 7-5`).

Source: Steven’s GameChanger HEIC (lab: `FIX-REPORT.json` `ground_truth`).

### Batting (AB / R / H / RBI / BB / SO)

| Player | # | Pos | AB/R/H/RBI/BB/SO |
| --- | --- | --- | --- |
| L Morris | 42 | SS | **3/2/2**/0/0/0 |
| L Vannoy | 66 | CF | 2/1/1/0/1/0 |
| **L Layton** | **2** | **C** | **3/0/1/3**/0/1 |
| T Barnes | 27 | 3B | 2/0/0/0/1/1 |
| Hampton | 7 | 1B | 2/1/0/0/1/0 |
| Bruce | 8 | LF | 1/0/0/0/1/1 |
| C Koehn | 9 | RF | 1/1/1/0/1/0 |
| Ethan (Hale) | 67 | RF | 2/0/0/0/0/0 |
| Tyler (Grisham) | 6 | 2B | 2/0/1/1/0/0 |
| Weston | 13 | 2B | 1/1/0/0/1/1 |
| J Lange | 23 | P | 2/1/0/0/0/1 |
| **TEAM** | | | **21/7/6/4/6/5** |

Also on photo extras (often missed): SB e.g. Morris 3, Vannoy 2.

### Pitching

| Player | # | Dec | IP | H | R | ER | BB | SO |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **J Lange** | **23** | **(W)** | **4.0** | 6 | **5** | 3 | 2 | **5** |
| **T Barnes** | **27** | **(S)** | **1.0** | 1 | **0** | 0 | 0 | **1** |

Acceptance hinges on: Morris **3/2/2**, Layton **#2 with 3 RBI**, Barnes **S 1.0**, batting R sum **7**, pitching R sum **5**, no filler/fake names, **no all-zeros batting**, **HEIC path works**.

---

## 6. Chronology of bugs & fixes

| # | Failure | Fix | SHA (approx) | Notes |
| --- | --- | --- | --- | --- |
| 1 | Missing `BOXSCORE_PASSWORD` → Analyze `503` | Set Worker secret (ops) | — | Never commit value |
| 2 | D1 unbound → stats/confirm 503 | Create/bind/schema/seed | `1812850` | Still current |
| 3 | Llama Meta license **5016** | Auto `{prompt:'agree'}` + retry | `9499e9b` | Still current |
| 4 | Default `max_tokens` **256** truncating JSON | `BOXSCORE_MAX_TOKENS = 4096` | `691881a` | Keep ≥4096 |
| 5 | iPhone HEIC broken | Client HEIC→JPEG + Worker **415**; Safari heic2any-first | `aed4cb9`, `0268986` | Still current |
| 6 | False “add date and opponent” validation | Clear stale errors; optional when photos present | `a62eae5` | |
| 7 | Prompt example poison → Hoegemeyer/McCain | Remove fake examples | `4d2ddd2` | Never reintroduce |
| 8 | Digit-collapse (every >1 → 1) | Digit rules + sum-check second pass | `4d2ddd2` | Audit only on run-sum mismatch |
| 9 | Loop 2: fat audits → **all-zeros + roster dump** | Revert bloated triggers; keep brace JSON | `a29aef0` / `3a88a82` | **Do not revive** |
| 10 | Roster filler #25–#40 + AB2 R1 H1 clones | Photo jerseys + `boxscore-filter.mjs` | **`f9c6017`** | Pre-Codex handoff HEAD |
| 11 | Llama 3.2 zero-filled batting on HEIC/JPEG trials | **Model swap → Llama 4 Scout** (no prompt bloat) | **`0f3cb19`** | See §7 honesty note |
| 12 | Mobile Date/Opponent field overlap | Full-width mobile meta fields | `3f41ba4` | |
| 13 | Schedule showed Upcoming after confirm | Live D1 result sync + aliases | `54fa222`, `2d18704` | |
| 14 | No public per-game box score | `/box-score?game=` + Stats list + linked pills | `27e1f2b` | |
| 15 | Linked navy pills unreadable | `!text-white` on result chips | `c2378a7` | Known `a { color: inherit }` trap |

### Photo-verified jerseys (seed / D1 after `f9c6017`)
**Set:** Morris 42, Vannoy 66, Luke Layton 2, Barnes 27, Hampton Travis 7, Bruce/Novacek 8, Koehn 9, Ethan Hale 67, Tyler Grisham 6, Weston Travis 13, Lange 23.

**Left null (not in that photo / unverified):** Hayden Baker, Rick Delgadillo, Elijah Layton, Grayson Yates.

`TRUSTED_JERSEYS` in filter (`boxscore-filter.mjs`):
```js
export const TRUSTED_JERSEYS = new Set([42, 66, 2, 27, 7, 8, 9, 67, 6, 13, 23]);
```

---

## 7. What Codex fixed vs what may still be open

### Fixed with code evidence (shipped in tree at `c2378a7`)
1. **Vision model** is Scout (`0f3cb19`); unit test locks the constant.
2. **Mobile submit meta fields** no longer overlap (`3f41ba4`).
3. **Saved results sync to Home/Schedule** when opponent matching is unique (`54fa222`).
4. **PG age/coach suffix aliases** match shorter GameChanger names without attaching ambiguous scores (`2d18704`).
5. **Individual box-score pages** + Stats “Game Box Scores” list + linked result pills (`27e1f2b`).
6. **Linked pill contrast** readable on navy (`c2378a7`).

### Claimed by Codex docs / commit message — re-verify live
- PROJECT-GUIDE (`0f3cb19`) states Llama 3.2 returned zero-filled batting rows while Scout “read the verified Sep. 26 fixture consistently.”
- **Honesty gap:** `/workspace/.tmp-heic-compare/` still only has pre-Scout lab reports (`FILTER-RETEST-REPORT.json`, etc.). There is no checked-in Scout HEIC/JPEG analyze JSON on the box. **Do not treat HEIC Analyze as closed until a live `/submit` retest against §5 ground truth passes.**

### Still open / residual (do not invent “fixed”)
- Pre-Scout live HEIC failure (~7pm CT Sep 26, Steven `IMG_7516.heic`): all-zeros batting, run-sum warnings, polluted roster, wrong Lange line — documented in original handoff §7B. Whether Scout cured **that exact path** is not proven by a saved artifact here.
- Chronic residuals even on “good” JPEG parses after `f9c6017`: missing Layton #2 / Barnes save, RBI/BB/SO often 0, Lange K/W missed, name-expansion oddities (`E Ethan`, etc.). Filter cannot invent missing players or fix all-zeros.
- Ambiguous same-day doubleheaders still intentionally show **no** live result (safer than wrong pill).
- `schedule.json` may still lack `result` until someone commits PG/manual updates; live pills fill the gap only when D1 has a unique match.

---

## 8. What helped vs what hurt

### Helped
- Setting `BOXSCORE_PASSWORD` + binding D1.
- License agree + `max_tokens` 4096.
- Client HEIC conversion + Worker 415.
- Removing poisoned fake player examples.
- Digit / sum-check rules **without** bloating audit triggers.
- Post-filters + real D1 jerseys (`f9c6017`).
- **Model upgrade to Scout instead of fattening the prompt** (`0f3cb19`).
- Brace-balanced `extractJsonObject`.
- Mandatory Confirm UI + amber warnings that never block save.
- Conservative schedule matching (reject ambiguity) + alias containment with ≥8-char floor.

### Hurt (do not repeat)
- Inflating the vision prompt / completeness audits → loop-2 all-zeros + roster dump.
- Preferring longer audit batting lists on ties.
- Fake example players in the prompt.
- Treating Manual entry as the product fix.
- Auto-saving without review.
- Inventing jersey numbers for unverified roster players.
- Forgetting `!text-white` / inline colors when links sit on navy (global `a { color: inherit }`).

---

## 9. Suggested next checks (post-Codex)

1. **Live HEIC Analyze on Scout** — upload Steven’s Sep 26 HEIC (or lab `source.heic` via client convert) on production `/submit`; save JSON under `/workspace/.tmp-heic-compare/` with a `scout-` prefix.
2. Confirm Morris **3/2/2**, Layton **#2 / 3 RBI**, Barnes **(S) 1.0**, run sums **7/5**, no all-zeros.
3. Confirm Save → Home/Schedule pill appears and links to `/box-score?game=<id>` with white text.
4. If Scout still zeros on HEIC, inspect conversion quality **before** touching `boxscorePrompt` — do not fatten the prompt.
5. Keep football minute cron and baseball `*/15` pollers untouched.

---

## 10. Acceptance criteria

A vision fix is done when **both** lab JPEG and **real iPhone HEIC** Analyze on live `/submit` produce a REVIEW that meets:

| Check | Target |
| --- | --- |
| Morris | **AB/R/H = 3/2/2** (jersey 42) |
| Layton | Present as **#2**, **RBI = 3** |
| Barnes pitching | Present **(S)**, **IP 1.0**, ~0 R |
| Lange pitching | **~4.0 IP**, **~5 R**, **(W)** preferred; SO closer to 5 |
| Batting R sum | **= 7** |
| Pitching R sum | **= 5** |
| Roster | No sequential junk jerseys, no fake example players |
| Zeros | **Not** all batting stats 0 while header says 7–5 |
| HEIC | iPhone HEIC upload works end-to-end |
| Confirm | Still required; no auto-save |
| Publish path | After confirm, unique match shows linked result pill + `/box-score` page |
| Football | Minute score cron still healthy; baseball `*/15` pollers untouched |

Amber warnings for small residual digit errors are OK if the grid is editable and mostly correct. All-zeros or fake roster is **not** OK.

---

## 11. Explicit DO NOT / guardrails

1. **Do NOT inflate the vision prompt** as the primary fix.
2. **Do NOT put fake player examples** in the prompt.
3. **Do NOT invent jersey numbers** for Baker / Delgadillo / Elijah Layton / Yates without a photo.
4. **Do NOT auto-save** Analyze output; Confirm UI stays mandatory.
5. **Do NOT tell Steven “use Manual entry”** as the solution.
6. **Do NOT mix Klein Cain football** into baseball fixes — and don’t break the football minute cron.
7. **Do NOT commit or print `BOXSCORE_PASSWORD`.**
8. **Do NOT invent game scores/stats** not on the photo / D1.
9. **Do NOT deploy via GitHub Pages** expecting 413 to update — Cloudflare only.
10. **Do NOT prefer longer audit dumps** on tied sum issues (`preferBoxscoreParse`).
11. **Do NOT attach schedule results on ambiguous doubleheaders** — showing nothing is safer.
12. Recursive improvement must be small and measured — one hypothesis, one deploy, retest HEIC + JPEG.

---

## Appendix A — Critical code pointers (HEAD `c2378a7`)

- Vision model + `runBoxscoreVision`: `cloudflare/worker.mjs` (`BOXSCORE_VISION_MODEL`, `BOXSCORE_MAX_TOKENS = 4096`).
- Prompt: `boxscorePrompt()` — shape placeholders, digit accuracy, anti-pad roster discipline; **unchanged by Scout swap**.
- POST pipeline: password → HEIC 415 → vision → brace JSON → optional audit → `filterRosterDump`.
- Client Analyze: `boxscore-submit.tsx` `prepareImagesForUpload` then `POST /api/baseball/boxscore` → `setPhase('review')` (never auto-confirm).
- HEIC: `heic-to-jpeg.ts` `preferHeic2AnyFirst()` true on Safari.
- Filter clone signature: `isCloneBatRow` → `r===1 && h===1 && (ab===2 || ab===3)`.
- Schedule match: `live-stats.ts` `opponentsMatch` / `findSavedGame`.
- Public box score: `game-box-score.tsx` ← `GET /api/baseball/games/:id`.

---

## Appendix B — Seed roster reference (`scripts/baseball-seed.mjs`)

```js
const ROSTER = [
  ['Hayden Baker', 'SS', 2031, null],
  ['Teagan Barnes', 'RHP', 2030, 27],
  ['Rick Delgadillo', '1B', 2030, null],
  ['Tyler Grisham', '2B', 2030, 6],
  ['Ethan Hale', 'C', 2030, 67],
  ['Caden Koehn', '2B', 2030, 9],
  ['Jayden Lange', '3B', 2030, 23],
  ['Elijah Layton', 'OF', 2030, null],
  ['Luke Layton', 'C', 2030, 2],
  ['Landon Morris', 'SS', 2030, 42],
  ['Bruce Novacek', 'OF', 2030, 8],
  ['Hampton Travis', 'RHP', 2030, 7],
  ['Weston Travis', 'RHP', 2030, 13],
  ['Levi Vannoy', '3B', 2030, 66],
  ['Grayson Yates', 'LHP', 2030, null],
];
```

```bash
node scripts/baseball-seed.mjs > /tmp/seed.sql
wrangler d1 execute 413baseball-stats --remote --file=/tmp/seed.sql
```

---

## Appendix C — Related lab artifacts

1. `/workspace/.tmp-heic-compare/FIX-REPORT.json` — ground truth + digit-collapse  
2. `/workspace/.tmp-heic-compare/LOOP2-REVERT-REPORT.json` — all-zeros roster dump root cause  
3. `/workspace/.tmp-heic-compare/FILTER-RETEST-REPORT.json` — post-`f9c6017` JPEG 3× (pre-Scout)  
4. This file — post-Codex architecture + honesty on Scout re-verify  

---

*End of refreshed handoff. Scout replaced Llama 3.2 without fat prompts; publish path now syncs unique D1 results to schedule and individual box-score pages. Re-verify live HEIC against Morris 3/2/2, Layton #2 / 3 RBI, Barnes S, run sums 7/5 before calling vision closed.*
