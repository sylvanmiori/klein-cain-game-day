export function gameSlug(game) {
  return `${game.date}-${game.opponent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

export function activeGame(schedule, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const hour = Number(parts.hour);
  if (hour >= 2 && hour < 18) return null;
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  if (hour < 2) date.setUTCDate(date.getUTCDate() - 1);
  return schedule.find(game => game.date === date.toISOString().slice(0, 10)) || null;
}

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Linear-time removal of DCTF heavy fields. Avoids regex backtracking on multi-MB HTML. */
export function stripHeavyScoreFields(jsonText) {
  let out = '';
  let i = 0;
  const n = jsonText.length;
  while (i < n) {
    const atRender = jsonText.startsWith('"render":"', i);
    const atErrors = jsonText.startsWith('"errorList":[', i);
    if (!atRender && !atErrors) {
      out += jsonText[i++];
      continue;
    }
    if (out.endsWith(',')) out = out.slice(0, -1);
    if (atRender) {
      i += '"render":"'.length;
      while (i < n) {
        const c = jsonText[i++];
        if (c === '\\') {
          if (i < n) i += 1;
          continue;
        }
        if (c === '"') break;
      }
    } else {
      i += '"errorList":['.length;
      let depth = 1;
      while (i < n && depth > 0) {
        const c = jsonText[i++];
        if (c === '"') {
          while (i < n) {
            const d = jsonText[i++];
            if (d === '\\') {
              if (i < n) i += 1;
              continue;
            }
            if (d === '"') break;
          }
          continue;
        }
        if (c === '[') depth += 1;
        else if (c === ']') depth -= 1;
      }
    }
    if (jsonText[i] === ',') i += 1;
  }
  return out;
}

/**
 * After strip, DCTF rows are flat primitive objects (~500B). Pull only objects whose
 * school field matches — never JSON.parse the full ~500KB+/1100-row Friday array.
 */
export function extractSchoolGames(dataText, schoolName) {
  const escaped = String(schoolName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    '\\{[^{}]*"school"\\s*:\\s*"' + escaped + '"[^{}]*\\}',
    'g',
  );
  const rows = [];
  for (const match of dataText.matchAll(pattern)) {
    try {
      rows.push(JSON.parse(match[0]));
    } catch {
      // Skip malformed candidates; unique-match below will fail closed if needed.
    }
  }
  return rows;
}

function matchGames(data, schoolName, opponent) {
  const rows = typeof data === 'string'
    ? extractSchoolGames(data, schoolName)
    : (Array.isArray(data) ? data : null);
  if (!rows) throw new Error('Score source format changed.');
  return rows.filter(item => normalize(item.school) === normalize(schoolName)
    && normalize(item.opponent) === normalize(opponent));
}

export function parseScore(payload, game, schoolName, previous, now = new Date()) {
  const envelope = typeof payload.d === 'string' ? JSON.parse(payload.d) : payload.d;
  if (!envelope?.success) throw new Error('Score source returned an unsuccessful response.');
  // Friday-night DCTF payloads are multi-MB because every row embeds HTML in `render`
  // (and unused errorList). Linear-strip those, then extract only the target school's
  // flat row(s) — never JSON.parse the full slimmed array (still ~537KB / 1100 rows).
  let data = envelope.data;
  if (typeof data === 'string') data = stripHeavyScoreFields(data);
  const matches = matchGames(data, schoolName, game.opponent);
  if (matches.length !== 1) throw new Error('Score source did not uniquely match the scheduled game.');
  const result = matches[0];
  const label = String(result.status || '').trim();
  const status = /final/i.test(label) ? 'final'
    : /quarter|qtr|q[1-4]|1st|2nd|3rd|4th|half|\\bot\\b|delay|live/i.test(label) ? 'live'
    : /scheduled|[ap]\\.?m\\.?/i.test(label) ? 'scheduled' : null;
  if (!status) throw new Error(`Unrecognized game status: ${label}`);
  const numeric = value => value !== null && value !== undefined && String(value).trim() !== ''
    && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 200;
  if (status !== 'scheduled' && (!numeric(result.score) || !numeric(result.opponentScore))) {
    throw new Error('Invalid score; keeping the last verified result.');
  }
  let cainScore = Number(result.score);
  let opponentScore = Number(result.opponentScore);
  const sameGame = previous?.slug === gameSlug(game);
  if (sameGame && previous.status === 'final' && status !== 'final') return previous;
  // Live feeds occasionally flicker a prior score (e.g. MW 7 → 0). Never let cron
  // publish a lower live total than the last verified live/final for this slug.
  if (sameGame && previous && previous.status !== 'scheduled' && status === 'live'
    && Number.isInteger(previous.homeScore) && Number.isInteger(previous.awayScore)) {
    const prevCain = game.home ? previous.homeScore : previous.awayScore;
    const prevOpp = game.home ? previous.awayScore : previous.homeScore;
    if (cainScore < prevCain || opponentScore < prevOpp) {
      cainScore = prevCain;
      opponentScore = prevOpp;
    }
  }
  // Records stay as independently verified editorial data; polling must not increment them.
  return {
    schemaVersion: 1, slug: gameSlug(game), status,
    statusLabel: status === 'scheduled' ? game.kickoff : label,
    homeScore: status === 'scheduled' ? null : game.home ? cainScore : opponentScore,
    awayScore: status === 'scheduled' ? null : game.home ? opponentScore : cainScore,
    homeRecord: sameGame ? previous.homeRecord : '',
    awayRecord: sameGame ? previous.awayRecord : '',
    updatedAt: now.toISOString(),
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.texasfootball.com/scores/',
  };
}

export async function fetchGameScore(game, schoolName, previous) {
  const [year, month, day] = game.date.split('-');
  const response = await fetch('https://www.texasfootball.com/api/schools/scoresGetJson', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameDate: `${month}/${day}/${year}`, schTypeTagId: 1, classConfTagId: -1, statusId: -1 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Score source HTTP ${response.status}`);
  const raw = await response.text();
  if (raw.length > 8_000_000) throw new Error('Score source payload too large.');
  return parseScore(JSON.parse(raw), game, schoolName, previous);
}
