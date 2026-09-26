# Creating an edition

An edition is one JSON file in this directory. Adding the file adds the page.
No TypeScript, route or component changes are needed.

Most of the time you do not need to do this by hand. `npm run editions` creates
a starter edition for every scheduled game that lacks one, deriving the teams,
mascots, dates, venue and titles, and the scheduled workflow runs it daily. Use
the steps below when you want to write a fuller edition: players to watch,
recruiting notes, keys and game information are never auto-generated. They are
written by the site's editor (Sylvan), with every claim verified against a named
source; never invent or infer scores, statistics, records, rankings, recruiting
information or player performance.

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
- A preview with opponent player capsules needs an `opponentRecruitingAudit`
  covering the full current roster, not only the players already selected.
  Every verified college commit in that audit must be included in **Players to
  watch**, with the college commitment stated in both the capsule and the
  linked recruiting note. Offers and interest are not commitments.
- The same audit must record every opponent ranked in a named service's top 10
  at his position or top 100 nationally. Those elite prospects must appear in
  **Players to watch**, and the card must foreground the source-specific rank
  and class. Give exceptional players proportionate context: verified recent
  production, major honors, offer count and relevant family football pedigree.
  Never turn an offer into a commitment or blend rankings from different
  services into one number.
- `disclaimerEntities` must name this game's opponent.
- `slug` must be `<date>-<opponent slug>`, the same key the score Worker uses.
- Both teams need local logo files. Placeholder or missing logo paths fail validation.
- A `preview` must carry at least one filled section. The template below is
  deliberately empty, so it fails validation until real content is added.
- Postgame leaders need a stat, a detail and a named box score. Do not list a
  pregame player as a leader without verified postgame statistics.
- Photo gallery captions must resolve players by name, number and position against
  `content/roster-2026.json` (or opponent rosters). Generic "Jersey <number>" placeholders fail validation.
- Leadership references must match verified records: head coaches must agree with
  `config/coaches.json` and campus principals with `config/publication.json`.
- Video highlights (`final.video`): `poster` and `src` must point to local files under
  `public/` (e.g. `public/videos/<slug>/`), `title` must be non-empty, and `sourceUrl` must use https.

## Head coaches

Head coaches live in `config/coaches.json`, not in edition JSON. The site
renders a **Head coaches** section on every preview and final game page from
that file, and the program page shows Klein Cain’s coach between games. Each
profile includes a verified **Career stops** list; update those entries when
you refresh a coach’s bio from Klein Cain Athletics, the school district or
Dave Campbell’s season preview.

When writing a preview intro, name each head coach once in the body — enough
for readers to connect the matchup section to the story. A sentence of
game-specific context on the opposing coach is appropriate when it is verified
(for example recent streak or game stakes). Use the coach’s last name on second
reference if needed. Do not paste the bio or career stops from `coaches.json`
into the intro; the **Head coaches** section already presents both head coaches
side-by-side with their full bios, career stops, tenure, and verified source links.
A fact row such as `Head coaches · James Clancy · Ben McGehee` in
**Game information** is optional but helpful.

Update `config/coaches.json` when a school changes head coaches. Every
scheduled opponent must have an entry; `npm run docs:check` fails if one is
missing.

## Fields

`preview`, `final`, `prediction`, `weather`, `gameStats`, `intro`, `recruiting`, `keys` and
`gameInfo` accept `null` when the information does not exist yet. A null
section is omitted from the page rather than rendered empty. `updated`,
`event`, `ogImage` and `footerNote` accept an empty string.

`final.video` is an optional `VideoHighlight` object (`title`, `caption`, `src`, `fallbackSrc`,
`poster`, `duration`, `credit`, `sourceUrl`). When included, `src` and `poster` must be local paths
starting with `/`.

`recapNotes` holds optional postgame editorial commentary, quotes, or sideline
observations. When provided, commentary is woven directly into the recap narrative
(`final.body`) as editorial paragraphs in a rich NY Times / Athletic style. It is
never published as an isolated section titled "Extra". Leave the field out or set
it to `null` when you have no additional commentary to add.

### Editorial copy formatting

`preview.intro.body` and `final.body` support light inline formatting, rendered
by the shared `EditorialCopy` component (`components/edition-page.tsx`):

- Blank lines start a new paragraph.
- `**double asterisks**` bold a key number, phrase, or player name.
- `*single asterisks*` italicize a player quote or a voice aside.

Keep paragraphs short (two to three sentences). Bold player names on first
mention, with jersey number (e.g. `**Jace Hanks (#9)**`), plus scores, records,
rankings, and the one most important phrase per paragraph. Bold sparingly, not
every mention; use italics only for quotes and asides. Plain text with no
markup renders exactly as before.

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
  "home": { "name": "Magnolia West", "mascot": "Mustangs", "logo": "/magnolia-west-logo.png", "record": "", "rank": null },
  "away": { "name": "Klein Cain", "mascot": "Hurricanes", "logo": "/favicon.png", "record": "", "rank": null },
  "pageTitle": "2026 Week 4 Preview: Klein Cain at Magnolia West",
  "metaTitle": "Week 4 Preview: Klein Cain at Magnolia West | Cain Game Day",
  "metaDescription": "",
  "socialDescription": "",
  "ogImage": "",
  "prediction": null,
  "massey": null,
  "rankings": null,
  "stats": null,
  "rating": null,
  "weather": null,
  "gameStats": null,
  "scheduledFacts": [],
  "resultFacts": [],
  "preview": {
    "playersHeading": "Players to watch",
    "playersNote": "",
    "playerStatsAudit": null,
    "intro": null,
    "players": [],
    "recruiting": null,
    "opponentRecruitingAudit": null,
    "keys": null,
    "gameInfo": null
  },
  "final": null,
  "recapNotes": null,
  "finalScore": null,
  "sources": [],
  "footerNote": "Independent fan publication · Information will be rechecked before kickoff.",
  "disclaimerEntities": ["Klein ISD", "Klein Cain High School", "Magnolia West High School"],
  "current": false
}
```
