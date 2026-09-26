# GrokBot Handoff Runbook — Klein Cain Gameday Report

Two AIs run this project. Sylvan is the full-time editor/manager with FULL publishing authority. GrokBot runs in parallel as monitor/track/draft ONLY. This runbook is binding on both. Read it before touching anything.

## 1. Roles and ownership

**Sylvan owns:** everything publishable. Repo commits and pushes, social posts (X @CainGameday, Instagram @caingameday, Facebook Page, Reddit u/CainGameday), photo selection and ingestion, Trello card management, cron job edits, any destructive or state-changing action.

**GrokBot owns, UNPROMPTED:** watching games and data feeds, tracking state (scores, stats, weather, rankings), and drafting copy in workspace files. GrokBot never publishes, posts, pushes, merges, deletes, or edits scheduled jobs unless Steven explicitly reassigns a task.

**When both are active (single-writer rule):** exactly one AI writes to each surface at a time.
- Repo: one AI pushes. The other does not touch branches, commits, or refs.
- Social: one AI posts per platform. The other does not draft-to-publish on that platform.
- If both are online, Steven or Sylvan names who is on point before work starts. No one infers the split from silence.

## 2. GrokBot may / may not do unprompted

**May (unprompted):**
- Monitor live games, scores, stats feeds, DCTF predictions, weather, rankings.
- Track state in workspace files and goal notes.
- Draft copy (previews, recaps, social posts) into workspace draft files and hand them to Sylvan with a live link or file path.
- Flag anomalies (score changes, stat conflicts, site down) to Steven or Sylvan.

**Forbidden (unprompted, no exceptions):**
- Publishing to the repo (commits, pushes, merges, PRs).
- Posting to X, Instagram, Facebook, or Reddit.
- Pushing, merging, deleting anything in the repo or on Trello.
- Changing cron jobs or scheduled jobs.
- Taking over a task mid-flight without a handoff (see section 3).

## 3. Handoff triggers and protocol

**Triggers:** an AI runs out of tokens, goes offline, or Steven reassigns work.

**The outgoing AI's handoff must state all four, in writing:**
1. **Already published** — what shipped, with live links (repo commit link, post URLs).
2. **Drafted** — what is drafted, exact file path of each draft.
3. **In flight** — running jobs, crons about to fire, browser sessions open.
4. **Next pending action** — the single next thing to do, and who should do it.

**Incoming AI rules:**
- Announce the handoff in your first action: "Taking over from Sylvan/GrokBot per handoff. Verifying state before touching anything."
- Re-verify state before touching anything: read the repo remote HEAD, read `hidden_files/social-published.log`, check open browser tasks. Do not trust the handoff blind.
- No silent takeovers. If you cannot verify state, stop and ask Steven.

## 4. Pre-publish checklist (mandatory before ANY publish or post)

1. No em dashes anywhere in the copy. (Use commas, periods, or colons.)
2. Recap body renders centered at correct width. Verify in the browser, do not assume. The 2026-09-25 CSS width bug (recap body left-aligned) is the reason this line exists.
3. Player name is always "Earl Oguinn Jr." Never "Rico."
4. No Steven attribution and no SportCast citation in body or social copy. Source reconciliation lives only in internal source notes (`files/SOURCES.md`), never in published copy.
5. Dave Campbell's cited by name whenever its prediction is used ("Dave Campbell's had Tomball by 3", not "the computer said..."). "Prediction model" is acceptable only when naming does not fit.
6. `hidden_files/social-published.log` checked before EVERY post. Append your entry immediately after posting, in the same action sequence.
7. Verify the live page or post after publishing, then report the live link.

## 5. Duplicate-post prevention

- `hidden_files/social-published.log` is the single source of truth for everything posted.
- Check-then-append as atomically as possible: read the log, confirm the post is not in it, post, append the entry with timestamp and URL immediately.
- On ANY ambiguity (a cron may have fired, the log entry is unclear, you are not sure who posted last): do NOT post. Ask Steven first.

## 6. Escalation: stop and ask Steven

Stop and ask instead of guessing when:
- A login fails or a CAPTCHA/2FA challenge appears that you cannot complete.
- Repo or social state conflicts (remote HEAD moved, a post exists that the log does not record, or vice versa).
- Stats are unverified or sources disagree.
- The action is destructive: delete, merge, force-push, removing a published post or commit.
- A handoff is incomplete or state cannot be verified.
- Any money moves or purchases.

One-line escalation rule: if the wrong guess ships publicly or destroys state, do not guess. Ask.

## 7. Degraded mode: Steven unreachable on game night

Facebook posting needs an SMS 2FA code from Steven's phone. If he is unreachable and a code is required:
- Post to X and Instagram normally. Do NOT park the whole night waiting on Facebook.
- Skip Facebook for that post. Log the skip in `hidden_files/social-published.log` with reason `fb-2fa-unreachable`.
- Report the skip to Steven in the post-game summary so he knows Facebook missed it.
- Never attempt the passkey, never retry a rejected code, never ask a third party for the code.

---

*Standing social rules also apply: bold-first-mention player styling, real @-mention photo credits on their own line, tag featured players by handle, The Read formatting, and the photo credit conventions in AGENTS.md.*

## 8. 4:13 Baseball (same repo, separate site)

`413baseball.gameday.report` shares the Worker but must never show Klein Cain football in titles, images, or link previews. Before baseball UI or metadata work, read [`docs/baseball-site.md`](baseball-site.md). Live baseball deploys require `npm run deploy:cloudflare` (GitHub Pages alone is not enough). Do not invent Perfect Game scores or box-score stats.
