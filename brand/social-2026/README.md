# Cain Game Day social identity

An independent editorial brand for the Klein Cain edition of **Game Day Report**. This package is for social accounts and promotion; it does **not** replace the school's logo, the site's favicon, or any existing page artwork. No school or district endorsement is implied.

## Start here: upload files

| Use | Upload this file | Size |
| --- | --- | --- |
| X profile image | `x-avatar-400.png` | 400 × 400 |
| X header | `x-header-1500x500.png` | 1500 × 500 |
| Instagram profile image | `avatar-1024.png` | 1024 × 1024 |
| Instagram launch/feed post | `instagram-launch-1080x1350.png` | 1080 × 1350 |
| Instagram Story | `instagram-story-1080x1920.png` | 1080 × 1920 |
| Reddit community icon | `reddit-avatar-256.png` | 256 × 256 |
| Reddit community banner | `reddit-banner-1080x128.png` | 1080 × 128 |
| Other profiles / high-resolution avatar | `avatar-1024.png` | 1024 × 1024 |

X's recommended 400 × 400 profile and 1500 × 500 header sizes are in [X Help](https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo.html). Reddit's current [banner guidance](https://support.reddithelp.com/hc/en-us/articles/15484339588884-Banner) recommends 1080 × 128. Instagram has no profile header/banner, so use the square mark for its profile and the post/story files for the account launch. Check each platform's in-app crop preview before saving, especially X mobile.

## Identity

- **Parent brand:** Game Day Report (`gameday.report`).
- **Edition name:** Cain Game Day. This matches the site's existing wordmark.
- **Descriptor:** Independent Klein Cain football coverage.
- **Voice:** Accurate, compact, clear-eyed sports reporting. No school-official tone or invented hype.
- **Mark:** `GD` + `REPORT` in an editorial scorebug. It deliberately does not copy the Klein Cain school mark; it can scale to other school editions later.

Use `logo-mark.svg` for vector production, `logo-mark-light.svg` on light backgrounds, and `wordmark.svg` when there is ample horizontal space. Don't stretch, rotate, recolor, or crowd the mark. Keep the monogram intact inside a square or circular social crop. The small `REPORT` line may disappear at tiny sizes; the `GD` remains the identifier.

## Tokens

| Role | Hex |
| --- | --- |
| Ink / night | `#17181E` |
| Cain purple | `#612694` |
| Violet accent | `#9E63D6` |
| Paper | `#F5F5F7` |
| White | `#FFFFFF` |
| Secondary copy | `#C7BDCF` |

Typography is a heavy neutral sans: Helvetica Neue, then Arial/system sans. Use bold type sparingly, with generous space. The header photo should support legibility, never compete with the name. The palette deliberately follows the existing site (`app/globals.css`).

## Suggested account copy

**Display name:** Cain Game Day | Game Day Report

**Short bio:** Independent Klein Cain football coverage. Scores, previews, recaps, stats and photos. Not affiliated with Klein ISD. kleincain.gameday.report

**Link:** https://kleincain.gameday.report/

## Source and reproduction

The background stadium art (`stadium-background.png`) was generated with OpenAI's built-in image-generation tool from this prompt: “Atmospheric high-school football stadium at night, low from the 50-yard sideline, subtle field lines and distant floodlights, quiet editorial mood, very wide framing with dark negative space at center-left, charcoal/deep-violet/silver palette, no players, words, logos, school insignia or watermarks.” It is **illustrative**, not a photograph of Klein Memorial Stadium.

All logo and overlay typography is editable SVG authored for this package. PNG exports are reproducible with `node brand/social-2026/render.mjs` after `npm ci` in the repository. Keep the SVGs as masters; upload the PNGs to platforms. The rendering script uses `sharp` installed with the site's current dependency tree.

No existing production-site assets were replaced. If adopting the mark on the website later, do that as a separate design change and check the effect on the masthead, favicon and Open Graph card at mobile and desktop sizes.
