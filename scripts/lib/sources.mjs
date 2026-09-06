// Deterministic public-data fetchers. No language model is involved: every
// value here is read from a named source, validated, and attributed. A source
// that fails or returns something unexpected throws, and the caller keeps the
// previous verified value rather than publishing a guess.

const USER_AGENT = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';
// A statewide scores response is around a megabyte and is slower from a cloud
// runner than from a laptop, so this is generous and retried.
const TIMEOUT = 60000;
const ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function get(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'user-agent': USER_AGENT, ...options.headers },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await wait(attempt * 2000);
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ weather */

export const NWS_ATTRIBUTION = {
  source: 'National Weather Service',
  sourceUrl: 'https://www.weather.gov/',
};

/** Convert "7:00 PM" on a date into the hour key the NWS hourly feed uses. */
function kickoffHour(kickoff) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(kickoff.trim());
  if (!match) throw new Error(`Unrecognized kickoff time: ${kickoff}`);
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return hour;
}

/**
 * Forecast for the kickoff hour at a venue. The NWS hourly feed reaches about
 * six days ahead, so this returns null when the game is beyond the horizon
 * rather than reporting a forecast that does not exist.
 */
export async function fetchWeather({ lat, lon, date, kickoff }) {
  const point = await (await get(`https://api.weather.gov/points/${lat},${lon}`)).json();
  const hourlyUrl = point?.properties?.forecastHourly;
  if (!hourlyUrl) throw new Error('Weather source did not return an hourly forecast URL.');

  const forecast = await (await get(hourlyUrl)).json();
  const periods = forecast?.properties?.periods;
  if (!Array.isArray(periods) || periods.length === 0) throw new Error('Weather source returned no periods.');

  const hour = String(kickoffHour(kickoff)).padStart(2, '0');
  const match = periods.find((period) => period.startTime.startsWith(date) && period.startTime.slice(11, 13) === hour);
  if (!match) return null;

  const temperature = Number(match.temperature);
  const precip = match.probabilityOfPrecipitation?.value;
  const humidity = match.relativeHumidity?.value;
  if (!Number.isFinite(temperature) || !match.shortForecast) {
    throw new Error('Weather source returned an incomplete period.');
  }

  return {
    tempF: Math.round(temperature),
    condition: String(match.shortForecast),
    precipPct: Number.isFinite(precip) ? Number(precip) : null,
    humidityPct: Number.isFinite(humidity) ? Number(humidity) : null,
    wind: match.windSpeed ? `${match.windSpeed} ${match.windDirection || ''}`.trim() : null,
    ...NWS_ATTRIBUTION,
    asOf: new Date().toISOString(),
  };
}

/* ------------------------------------------------------ records and the pick */

export const DCTF_ATTRIBUTION = {
  source: 'Dave Campbell’s Texas Football',
  sourceUrl: 'https://www.texasfootball.com/',
};

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&rsquo;': '\u2019' };

/** Entities must be decoded before whitespace is collapsed: the rankings table
 *  separates a team from its record with &nbsp;, which is not \s until decoded. */
const stripTags = (html) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&amp;|&quot;|&#39;|&apos;|&rsquo;/g, (entity) => ENTITIES[entity])
  .replace(/\s+/g, ' ')
  .trim();

/**
 * District standings from the school's own team page, which is server
 * rendered. Returns a map of full team name ("Tomball Cougars") to overall
 * record, covering every district opponent in one request.
 */
export async function fetchTeamPage(teamPageUrl) {
  return (await get(teamPageUrl)).text();
}

export function parseDistrictRecords(html) {
  const heading = html.search(/District [^<]*Standings/i);
  if (heading === -1) throw new Error('Standings table not found on the team page.');
  const block = html.slice(heading, html.indexOf('</ul>', heading));

  const records = new Map();
  for (const [, row] of block.matchAll(/<li class="[^"]*">([\s\S]*?)<\/li>/g)) {
    const cells = [...row.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(([, cell]) => stripTags(cell));
    if (cells.length < 3) continue;
    const [team, , overall] = cells;
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(overall || '');
    if (!team || !match) continue;
    records.set(team, `${match[1]}–${match[2]}`);
  }
  if (records.size === 0) throw new Error('Standings table contained no readable records.');
  return records;
}

/**
 * Dave Campbell's publishes a weekly computer ranking of every Texas team as an
 * article. Team pages link the recent ones, so the newest is found by the date
 * in its URL rather than by guessing a slug.
 */
export function findRankingsArticle(html) {
  const paths = [...new Set(
    [...html.matchAll(/\/article\/(\d{4}\/\d{2}\/\d{2})\/(exclusive-computer-rankings-for-all-1500-txhsfb-teams-[a-z0-9-]+)/g)]
      .map(([path]) => path),
  )];
  if (paths.length === 0) return null;
  // The date sits at a fixed position, so lexical order is chronological.
  paths.sort((a, b) => a.localeCompare(b));
  return `https://www.texasfootball.com${paths[paths.length - 1]}`;
}

/** Statewide rank for every team in that article, keyed by the name it uses. */
export async function fetchStateRankings(articleUrl) {
  const html = await (await get(articleUrl)).text();
  const ranks = new Map();
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const rank = /<th[^>]*>[\s\S]*?<strong>\s*(\d+)\s*<\/strong>/.exec(row);
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (!rank || cells.length === 0) continue;
    const team = stripTags(cells[0][1]).replace(/\s*\(\d+-\d+\)\s*$/, '').trim();
    if (team) ranks.set(team, Number(rank[1]));
  }
  // The table covers roughly 1,500 teams. A handful means the markup changed.
  if (ranks.size < 500) throw new Error(`Rankings article yielded only ${ranks.size} teams.`);
  return ranks;
}

/* --------------------------------------------------------- season statistics */

export const MAXPREPS_ATTRIBUTION = {
  source: 'MaxPreps',
};

/**
 * Season stat leaders from a MaxPreps team stats page. The page ships its data
 * as a __NEXT_DATA__ JSON blob, so this reads structured values rather than
 * scraping rendered markup. robots.txt permits this path for every agent.
 *
 * These are season-to-date figures, not one game's box score. The caller must
 * label them that way. MaxPreps enters a Friday game the following morning, so
 * a snapshot taken too early would describe the season before the game.
 */
export async function fetchStatLeaders(statsUrl) {
  const html = await (await get(statsUrl)).text();
  return { ...parseStatLeaders(html), sourceUrl: statsUrl, asOf: new Date().toISOString() };
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parseStatLeaders(html) {
  const blob = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!blob) throw new Error('Stats page did not contain the expected data block.');

  let payload;
  try {
    payload = JSON.parse(blob[1]);
  } catch (error) {
    throw new Error(`Stats data block is not valid JSON (${error.message})`);
  }

  const data = payload?.props?.pageProps?.playerStatLeadersData;
  const rows = data?.leaders;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Stats page listed no leaders.');

  const leaders = [];
  for (const row of rows) {
    const stat = row?.stat;
    const name = `${row?.athleteFirstName ?? ''} ${row?.athleteLastName ?? ''}`.trim();
    if (!stat?.displayName || !name || stat.value === undefined || stat.value === null) continue;
    leaders.push({
      category: String(stat.displayName),
      header: String(stat.header ?? ''),
      name,
      position: String(row.athletePositions ?? '').trim(),
      value: String(stat.value),
      rank: Number.isInteger(row.currentRank) ? row.currentRank : null,
    });
  }
  if (leaders.length === 0) throw new Error('No usable stat leaders were found.');

  const updated = data?.lastUpdated?.timeStamp ?? null;
  if (!updated) throw new Error('Stats page did not say when it was last updated.');

  return { leaders, updated, ...MAXPREPS_ATTRIBUTION };
}

/* ----------------------------------------------------------- game statistics */

/** MaxPreps links every game from the team schedule. Matching the date avoids
 * opponent-name collisions such as Klein, Klein Cain and Klein Collins. */
export function findMaxPrepsGameUrl(html, isoDate) {
  const [, month, day] = isoDate.split('-').map(Number);
  const datePath = `/${month}-${day}-${isoDate.slice(0, 4)}/`;
  const urls = [...html.matchAll(/https:\/\/www\.maxpreps\.com\/[^"<\\]+\/football\/game\/[^"<\\]+\?c=[a-f0-9-]+/gi)]
    .map(([url]) => url.replaceAll('\\u0026', '&'));
  const found = urls.find((url) => url.includes(datePath));
  return found ? found.replace(/&tab=[^&]+/i, '') : null;
}

function rscText(html) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,(.*?)\]\)<\/script>/gs)];
  if (chunks.length === 0) throw new Error('Game stats page did not contain its data stream.');
  try {
    return chunks.map((match) => JSON.parse(match[1])).join('');
  } catch (error) {
    throw new Error(`Game stats data stream could not be decoded (${error.message})`);
  }
}

function objectAfter(text, label) {
  const at = text.indexOf(label);
  if (at === -1) throw new Error(`Game stats data did not contain ${label}.`);
  const start = text.indexOf('{', at + label.length);
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, index + 1));
      } catch (error) {
        throw new Error(`Game stats data was not valid JSON (${error.message})`);
      }
    }
  }
  throw new Error('Game stats data ended unexpectedly.');
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function playerName(row, roster = []) {
  const jersey = String(row.Jersey ?? '');
  const href = String(row._href ?? '');
  const slug = /\/athletes\/([^/?]+)/.exec(href)?.[1] ?? '';
  const normalizedSlug = slug.replace(/-/g, '');
  const rosterMatch = roster.find((player) => String(player.number) === jersey
    && normalizedSlug && String(player.name).toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSlug);
  if (rosterMatch) return rosterMatch.name;
  if (!slug) return String(row.Name ?? '').trim();
  return slug.split('-').map((part) => {
    if (part === 'jr') return 'Jr.';
    if (part === 'sr') return 'Sr.';
    if (part === 'aj') return 'AJ';
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' ');
}

/** Parse the covered school's game-only totals and leaders from a MaxPreps
 * matchup Stats tab. A null team entry means the coaches have not posted data;
 * that is an unavailable result, never a page full of zeroes. */
export function parseGameStats(html, { teamId, teamName, roster = [] }) {
  const stream = rscText(html);
  const byTeam = objectAfter(stream, '"statsByTeamId":');
  const team = byTeam?.[teamId];
  if (!team) return null;
  if (!Array.isArray(team.groups) || team.groups.length === 0) throw new Error('Game stats contained no stat groups.');

  const subgroups = team.groups.flatMap((group) => group.subgroups ?? []);
  const table = (name) => {
    const subgroup = subgroups.find((item) => item.name === name);
    if (!subgroup?.stats?.columns || !subgroup?.stats?.rows) return null;
    const columns = subgroup.stats.columns;
    const rows = subgroup.stats.rows.map((row) => {
      const values = Object.fromEntries(columns.map((column, index) => [column.name, String(row.columns?.[index]?.value ?? '')]));
      values._href = row.columns?.[1]?.href ?? '';
      return values;
    });
    const overall = Object.fromEntries(columns.map((column) => [column.name, String(column.overallValue ?? '')]));
    return { rows, overall };
  };
  const passing = table('Passing');
  const rushing = table('Rushing');
  const receiving = table('Receiving');
  const tackles = table('Tackles');
  const punts = table('Punts');
  const kicking = table('PATs and Field Goals');
  if (!passing || !rushing || !receiving) throw new Error('Game stats were missing core offensive tables.');

  const totals = [];
  const passYards = number(passing.overall.PassingYards);
  const rushYards = number(rushing.overall.RushingYards);
  totals.push({ label: 'Total offense', value: `${passYards + rushYards} yards`, detail: `${passYards} passing · ${rushYards} rushing` });
  totals.push({ label: 'Passing', value: `${passYards} yards`, detail: `${number(passing.overall.PassingComp)} of ${number(passing.overall.PassingAtt)} · ${number(passing.overall.PassingTD)} TD` });
  totals.push({ label: 'Rushing', value: `${rushYards} yards`, detail: `${number(rushing.overall.RushingNum)} carries · ${number(rushing.overall.RushingTDNum)} TD` });
  if (tackles && number(tackles.overall.TotalTackles) > 0) {
    totals.push({ label: 'Defense', value: `${number(tackles.overall.TotalTackles)} tackles`, detail: `${number(tackles.overall.Tackles)} solo · ${number(tackles.overall.TacklesForLoss)} TFL` });
  }
  if (punts && number(punts.overall.PuntNum) > 0) {
    totals.push({ label: 'Punting', value: `${punts.overall.PuntAverage} average`, detail: `${punts.overall.PuntNum} punts · long ${punts.overall.PuntLong}` });
  }
  if (kicking && (number(kicking.overall.PATKickingMade) > 0 || number(kicking.overall.FGMade) > 0)) {
    const fieldGoals = number(kicking.overall.FGAttempted) > 0
      ? `${number(kicking.overall.FGMade)}/${number(kicking.overall.FGAttempted)} FG`
      : 'no field-goal attempts';
    totals.push({ label: 'Kicking', value: `${number(kicking.overall.TotalKickingPoints)} points`, detail: `${number(kicking.overall.PATKickingMade)}/${number(kicking.overall.PATKickingAtt)} PAT · ${fieldGoals}` });
  }

  const leader = (category, source, statKey, statLabel, detail) => {
    const row = [...(source?.rows ?? [])].sort((a, b) => number(b[statKey]) - number(a[statKey]))[0];
    if (!row || !row[statKey]) return null;
    return { category, name: playerName(row, roster), number: row.Jersey, stat: `${row[statKey]} ${statLabel}`, detail: detail(row) };
  };
  const leaders = [
    leader('Passing', passing, 'PassingYards', 'passing yards', (row) => `${row.PassingComp} of ${row.PassingAtt} · ${number(row.PassingTD)} TD`),
    leader('Rushing', rushing, 'RushingYards', 'rushing yards', (row) => `${row.RushingNum} carries · ${number(row.RushingTDNum)} TD`),
    leader('Receiving', receiving, 'ReceivingYards', 'receiving yards', (row) => `${row.ReceivingNum} catches · ${number(row.ReceivingTDNum)} TD`),
    leader('Tackles', tackles, 'TotalTackles', 'total tackles', (row) => `${number(row.Tackles)} solo · ${number(row.TacklesForLoss)} TFL`),
    leader('Kicking', kicking, 'TotalKickingPoints', 'kicking points', (row) => {
      const fieldGoals = number(row.FGAttempted) > 0 ? `${number(row.FGMade)}/${number(row.FGAttempted)} FG` : 'no field-goal attempts';
      return `${number(row.PATKickingMade)}/${number(row.PATKickingAtt)} PAT · ${fieldGoals}`;
    }),
  ].filter(Boolean);

  const updated = team.lastUpdated?.timeStamp;
  if (!updated) throw new Error('Game stats did not say when they were last updated.');
  if (totals.length === 0 || leaders.length === 0) throw new Error('Game stats contained no usable figures.');
  return { team: teamName, totals, leaders, updated, ...MAXPREPS_ATTRIBUTION };
}

export async function fetchGameStats({ scheduleUrl, date, teamId, teamName, roster = [] }) {
  const scheduleHtml = await (await get(scheduleUrl)).text();
  const gameUrl = findMaxPrepsGameUrl(scheduleHtml, date);
  if (!gameUrl) throw new Error(`No MaxPreps game page was linked for ${date}.`);
  const sourceUrl = `${gameUrl}&tab=Stats`;
  const html = await (await get(sourceUrl)).text();
  const parsed = parseGameStats(html, { teamId, teamName, roster });
  return parsed ? { ...parsed, sourceUrl, asOf: new Date().toISOString() } : null;
}

/** Exact match on "<name> <mascot>", so "Klein" cannot match "Klein Cain". */
export function recordFor(records, team) {
  return records.get(`${team.name} ${team.mascot}`.trim()) ?? null;
}

/**
 * Dave Campbell's published pick for a scheduled game, as a signed margin from
 * the school's point of view. Verified against played games: +16 before a
 * one-point win, +18 before a 25-point win.
 */
export async function fetchScoreRows(isoDate) {
  const [year, month, day] = isoDate.split('-');
  const response = await get('https://www.texasfootball.com/api/schools/scoresGetJson', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameDate: `${month}/${day}/${year}`, schTypeTagId: 1, classConfTagId: -1, statusId: -1 }),
  });
  const payload = await response.json();
  const envelope = typeof payload.d === 'string' ? JSON.parse(payload.d) : payload.d;
  if (!envelope?.success) throw new Error('Score source returned an unsuccessful response.');
  const games = typeof envelope.data === 'string' ? JSON.parse(envelope.data) : envelope.data;
  if (!Array.isArray(games)) throw new Error('Score source format changed.');
  // Each game appears once per school and the two rows carry different game
  // ids, so the date is attached here to key them back together.
  return games.map((row) => ({ ...row, gameDate: isoDate }));
}

export async function fetchPick(game, schoolName) {
  const games = await fetchScoreRows(game.date);

  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rows = games.filter((row) => normalize(row.school) === normalize(schoolName)
    && normalize(row.opponent).includes(normalize(game.opponent)));
  if (rows.length !== 1) throw new Error('Pick source did not uniquely match the scheduled game.');

  const raw = rows[0].pick;
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const margin = Number(raw);
  if (!Number.isInteger(margin) || Math.abs(margin) > 100) throw new Error(`Unusable pick value: ${raw}`);
  return { margin, ...DCTF_ATTRIBUTION, asOf: new Date().toISOString() };
}
