/**
 * Perfect Game tournament pool-standings parsing for the 4:13 Baseball subsite.
 *
 * Pure module: no Node APIs, no Worker APIs. Shared by the Cloudflare Worker
 * standings poller (cloudflare/worker.mjs) and the Thursday schedule scraper
 * (scripts/baseball-pg.mjs) so both read TournamentPoolStandings.aspx the
 * same way.
 *
 * Page facts (verified 2026-09-26 against event 140434):
 * - Pool titles: id="...lblPoolTitle_{poolIdx}">Pool A</...>
 * - Standings rows are keyed by ASP.NET repeater control ids, NOT by a bare
 *   <tr>…</tr> scan. The same page embeds a DiamondKast scoreboard whose
 *   nested tables also contain team names; a greedy
 *   <tr>…hlTeam…</tr> regex swallows that HTML and corrupts cells
 *   (state="Game Recap", non-numeric W/L, etc.).
 * - Real row markers:
 *     rptrPools_rptrPoolStandings_{poolIdx}_tdSeedNum_{n}
 *     rptrPools_rptrPoolStandings_{poolIdx}_lblRownum_{n}  (seed / rank)
 *     rptrPools_rptrPoolStandings_{poolIdx}_hlTeam_{n}     (href + name)
 *   Following <td>s in the same row: state, pct, W, L, T, RA, RS.
 *
 * Never invents teams or records: everything returned is read from the page.
 */

export const PG_BASE = 'https://www.perfectgame.org';
export const STANDINGS_URL_FOR = (eventId) =>
  `${PG_BASE}/events/TournamentPoolStandings.aspx?event=${eventId}`;
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&rsquo;': '\u2019',
};
const decodeEntities = (value) =>
  String(value ?? '').replace(/&(?:nbsp|amp|quot|#39|apos|rsquo);/g, (e) => ENTITIES[e] ?? e);
const stripTags = (html) =>
  decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const nullIfEmpty = (value) => {
  const text = typeof value === 'string' ? value.trim() : value;
  return text === '' || text === undefined ? null : text;
};
const normName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Absolutize a Perfect Game relative href against the events path. */
export function absolutizePgUrl(href, base = `${PG_BASE}/events/`) {
  if (!href) return null;
  return new URL(decodeEntities(href), base).toString();
}

function parseIntOrNull(text) {
  const t = String(text ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

function parsePctOrNull(text) {
  const t = String(text ?? '').trim();
  // PG shows "1.000", "0.500", "0.000" (and occasionally "1" / "0").
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse TournamentPoolStandings.aspx HTML.
 * @param {string} html
 * @param {{ standingsUrl?: string|null, teamName?: string|null }} [opts]
 * @returns {{ standings_url: string|null, pools: Array<{pool: string, teams: Array}>, team_record: object|null }}
 */
export function parsePoolStandingsPage(html, { standingsUrl = null, teamName = null } = {}) {
  const poolTitles = [...html.matchAll(/id="[^"]*lblPoolTitle_(\d+)"[^>]*>([^<]*)</g)];
  const pools = poolTitles.map((titleMatch) => {
    const poolIdx = titleMatch[1];
    const pool = stripTags(titleMatch[2]);
    const teams = [];
    // Match ONLY standings team links by their repeater control id.
    const teamLinkRe = new RegExp(
      `id="[^"]*rptrPools_rptrPoolStandings_${poolIdx}_hlTeam_(\\d+)"[^>]*href="([^"]+)"[^>]*>([^<]*)<`,
      'g',
    );
    for (const linkMatch of html.matchAll(teamLinkRe)) {
      const rowNum = linkMatch[1];
      const href = linkMatch[2];
      const name = stripTags(linkMatch[3]);
      if (!name) continue;

      const seedRe = new RegExp(
        `id="[^"]*rptrPools_rptrPoolStandings_${poolIdx}_lblRownum_${rowNum}"[^>]*>([^<]*)`,
      );
      const seed = parseIntOrNull(stripTags(seedRe.exec(html)?.[1] ?? ''));

      // Cells after the team link until this row's </tr> — never scan backward
      // into DiamondKast (which sits earlier on the same page).
      const after = html.slice(linkMatch.index + linkMatch[0].length);
      const rowEnd = after.search(/<\/tr>/i);
      const rowTail = rowEnd >= 0 ? after.slice(0, rowEnd) : after.slice(0, 4000);
      const cells = [...rowTail.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        stripTags(m[1]),
      );
      // Expected: [state, pct, W, L, T, RA, RS]
      teams.push({
        seed,
        name,
        team_url: absolutizePgUrl(href),
        state: nullIfEmpty(cells[0]),
        pct: parsePctOrNull(cells[1]),
        w: parseIntOrNull(cells[2]),
        l: parseIntOrNull(cells[3]),
        t: parseIntOrNull(cells[4]),
        ra: parseIntOrNull(cells[5]),
        rs: parseIntOrNull(cells[6]),
      });
    }
    return { pool, teams };
  });

  let teamRecord = null;
  if (teamName) {
    const want = normName(teamName);
    for (const { pool, teams } of pools) {
      const row = teams.find((t) => normName(t.name) === want);
      if (row) {
        teamRecord = {
          pool,
          seed: row.seed,
          w: row.w,
          l: row.l,
          t: row.t,
          pct: row.pct,
          ra: row.ra,
          rs: row.rs,
        };
        break;
      }
    }
  }

  return {
    standings_url: standingsUrl ?? null,
    pools,
    team_record: teamRecord,
  };
}

/**
 * Build the KV snapshot. Last-good semantics are enforced by the caller:
 * this is only written after a successful fetch+parse.
 */
export function buildStandingsSnapshot({
  eventId,
  tournamentName,
  standingsUrl,
  pools,
  teamRecord,
  scrapedAt,
}) {
  return {
    schemaVersion: 1,
    event_id: String(eventId),
    tournament: tournamentName ?? null,
    standings_url: standingsUrl ?? null,
    pools: (pools ?? []).map(({ pool, teams }) => ({
      pool: pool ?? 'Pool',
      teams: (teams ?? []).map((t) => ({
        seed: t.seed ?? null,
        name: t.name ?? null,
        team_url: t.team_url ?? null,
        state: t.state ?? null,
        pct: t.pct ?? null,
        w: t.w ?? null,
        l: t.l ?? null,
        t: t.t ?? null,
        ra: t.ra ?? null,
        rs: t.rs ?? null,
      })),
    })),
    team_record: teamRecord ?? null,
    scraped_at: scrapedAt,
    source: 'Perfect Game',
  };
}
