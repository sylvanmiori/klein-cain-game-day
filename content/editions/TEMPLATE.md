# Creating an edition

An edition is one JSON file in this directory. Adding the file adds the page.
No TypeScript, route or component changes are needed.

Most of the time you do not need to do this by hand. `npm run editions` creates
a starter edition for every scheduled game that lacks one, deriving the teams,
mascots, dates, venue and titles, and the scheduled workflow runs it daily. Use
the steps below when you want to write a fuller edition: players to watch,
recruiting notes, keys and game information are never generated.

1. Copy the block below to `content/editions/<date>-<opponent-slug>.json`. The
   filename must equal the `slug`.
2. Fill in every field from verified sources. `config/season-2026.json` is the
   authority on date, opponent, venue, home/away and kickoff; the validator
   rejects an edition that disagrees with it.
3. Set `"current": true` on the edition the home page should show, and
   `false` on every other file. Exactly one edition may be current.
4. Run `npm run validate`, then `npm run build:cloudflare`, which also runs
   `scripts/check-build.mjs` to confirm no other opponent survives in the
   page's title, meta tags, heading or disclaimer.

## Rules the validator enforces

- Schedule agreement: teams, venue and kickoff must match the season file.
- `state` must be `preview` (no `final` section) or `final` (with one).
- Every preview player needs a non-empty `rating`. When no public rating
  exists, write what is true, such as `Not listed by Rivals`, rather than
  leaving it blank or inventing a number.
- Every recruiting row needs an `https` source link.
- `disclaimerEntities` must name this game's opponent.
- `slug` must be `<date>-<opponent slug>`, the same key the score Worker uses.
- A `preview` must carry at least one filled section. The template below is
  deliberately empty, so it fails validation until real content is added.
- Postgame leaders need a stat, a detail and a named box score. Do not list a
  pregame player as a leader without verified postgame statistics.

## Fields

`preview`, `final`, `prediction`, `weather`, `intro`, `recruiting`, `keys` and
`gameInfo` accept `null` when the information does not exist yet. A null
section is omitted from the page rather than rendered empty. `updated`,
`event`, `ogImage` and `footerNote` accept an empty string.

```json
{
  "schemaVersion": 2,
  "slug": "2026-09-25-magnolia-west",
  "week": 4,
  "issue": "03",
  "state": "preview",
  "date": "2026-09-25",
  "dateLong": "September 25, 2026",
  "dateShort": "SEP 25, 2026",
  "kickoff": "7:00 PM",
  "venue": "Magnolia West High School",
  "event": "",
  "updated": "",
  "home": { "name": "Magnolia West", "mascot": "", "logo": "/player-placeholder.svg", "record": "", "rank": null },
  "away": { "name": "Klein Cain", "mascot": "Hurricanes", "logo": "/favicon.png", "record": "", "rank": null },
  "pageTitle": "2026 Week 4 Preview: Klein Cain at Magnolia West",
  "metaTitle": "Week 4 Preview: Klein Cain at Magnolia West | Cain Game Day",
  "metaDescription": "",
  "socialDescription": "",
  "ogImage": "",
  "prediction": null,
  "weather": null,
  "scheduledFacts": [],
  "resultFacts": [],
  "preview": {
    "playersHeading": "Players to watch",
    "playersNote": "",
    "intro": null,
    "players": [],
    "recruiting": null,
    "keys": null,
    "gameInfo": null
  },
  "final": null,
  "sources": [],
  "footerNote": "Independent fan publication · Information will be rechecked before kickoff.",
  "disclaimerEntities": ["Klein ISD", "Klein Cain High School", "Magnolia West High School"],
  "current": false
}
```
