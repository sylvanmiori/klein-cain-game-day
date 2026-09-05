// Deterministic public-data fetchers. No language model is involved: every
// value here is read from a named source, validated, and attributed. A source
// that fails or returns something unexpected throws, and the caller keeps the
// previous verified value rather than publishing a guess.

const USER_AGENT = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';
const TIMEOUT = 20000;

async function get(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'user-agent': USER_AGENT, ...options.headers },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
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

const stripTags = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/**
 * District standings from the school's own team page, which is server
 * rendered. Returns a map of full team name ("Tomball Cougars") to overall
 * record, covering every district opponent in one request.
 */
export async function fetchDistrictRecords(teamPageUrl) {
  const html = await (await get(teamPageUrl)).text();
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
