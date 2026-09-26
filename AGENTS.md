# AI developer handoff

Two AIs operate this project: Sylvan (full-time editor/manager, owns all publishing) and GrokBot (monitor/track/draft only, never publishes unprompted). The binding operating rules, handoff protocol, pre-publish checklist, and duplicate-post prevention are in `docs/GROKBOT-RUNBOOK.md`. Read it before touching anything.

Read `README.md`, then `docs/PROJECT-GUIDE.md`, before changing this repository. The guide is the durable project memory: architecture, hosting, automation, data ownership, source behavior, design decisions, recovery and open work all live there.

## Non-negotiables

- Treat `config/season-2026.json` as the authority for dates, teams, venue, home/away and kickoff.
- Do not invent or infer scores, statistics, records, rankings, recruiting information or player performance. Keep the last verified value when a source fails.
- Preserve the distinction between machine-owned and editorial edition fields documented in the project guide.
- Never expose implementation labels, model names, debug copy, credentials or internal workflow language on public pages.
- Keep MaxPreps/Dave Campbell team matching exact. Similar school names in this district make substring matching unsafe.
- Store public assets locally; do not make page rendering depend on third-party image hotlinks.
- Keep the compact Apple Sports/Yahoo Sports design direction. Test desktop and mobile.
- Never use generic "Jersey <number>" placeholders in photo captions or alt text. Resolve player names, numbers and positions using `content/roster-2026.json` (and opponent rosters when available) in high-caliber sports journalism style.
- Attribute quotes and commentary as statements to reporters or Game Day (e.g., "[Name] said before kickoff" or "[Name] said"), never assuming or inventing internal team speech context like "told the team" or "addressed the locker room".
- Ensure school leadership references in copy and captions match verified personnel: head coaches must agree with `config/coaches.json` and campus principals with `config/publication.json`.
- When game highlight video is included, store video and poster assets locally under `public/videos/` with verified local files and an https source attribution.
- Never commit passwords, access tokens, payment details or Cloudflare secrets.

## Before handing work back

Run `git diff --check`, `npx tsc --noEmit`, `npm run test:score` and `npm run build:cloudflare`. If paths, commands, hosting, automation, sources, data ownership, design rules or known limitations changed, update the README and project guide in the same commit. `npm run docs:check` is part of both production builds.

Pushes to `main` deploy through Cloudflare Workers Builds. Do not report a production change complete until both the GitHub `deploy` check and `Workers Builds: gameday-report` check succeed and the public URL returns the expected result.
