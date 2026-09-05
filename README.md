# Cain Game Day

A weekly, cloud-built game-day briefing for Klein Cain varsity football.

## Live score system

The public page supports three game states: scheduled, live and final. On Thursday and Friday game nights, GitHub Actions checks Dave Campbell’s Texas Football for the current Klein Cain score. During an active game, one cloud job checks once per minute and publishes the latest result to the `live-data` branch. The page checks that feed every 30 seconds and stops after the game is final.

The score workflow also has a manual run option. Enter the game date, status and both scores in the GitHub Actions form to correct a delayed or inaccurate feed. No additional secret is required for live scores.

## How the cloud run works

GitHub Actions checks the 2026 schedule every Friday morning during football season. On game days it researches the matchup, writes a structured edition, resets the score card to its scheduled state, archives the JSON, builds the site, publishes GitHub Pages, and sends a short Gmail message linking to the page. The computer that created the project does not need to be on.

The workflow can also be run manually with a `YYYY-MM-DD` game date.

## One-time GitHub secrets

Add these repository Actions secrets before the next game:

- `OPENAI_API_KEY`: used by the Responses API with web search to research and draft each edition.
- `GMAIL_USER`: the full Gmail address used as the sender.
- `GMAIL_APP_PASSWORD`: a Google app password for that Gmail account.
- `NEWSLETTER_TO`: one address or a comma-separated recipient list.

The website still publishes from checked-in content without these credentials. The automated research and email steps need them.

## Editorial rules

Every issue must verify records, rankings, recruiting status and star ratings. Missing public data is labeled unavailable. The generation prompt bans unsupported claims, generic hype, rhetorical setups, canned conclusions and other filler.
