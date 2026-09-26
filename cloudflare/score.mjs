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

/** Pull one game object out of the DCTF data array string without parsing every row. */
export function extractGameRow(data, schoolName, opponent) {
  const schoolNeedle = `"school":"${schoolName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const normSchool = normalize(schoolName);
  const normOpp = normalize(opponent);
  const matches = [];
  let idx = 0;
  while ((idx = data.indexOf(schoolNeedle, idx)) !== -1) {
    let start = idx;
    while (start > 0 && data[start] !== '{') start--;
    let depth = 0;
    let end = start;
    for (let i = start; i < data.length; i++) {
      if (data[i] === '{') depth++;
      else if (data[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    const row = JSON.parse(data.slice(start, end + 1));
    if (normalize(row.school) === normSchool && normalize(row.opponent) === normOpp) matches.push(row);
    idx += schoolNeedle.length;
  }
  return matches;
}

function findGameRow(envelope, game, schoolName) {
  if (typeof envelope.data === 'string') {
    const matches = extractGameRow(envelope.data, schoolName, game.opponent);
    if (matches.length !== 1) throw new Error('Score source did not uniquely match the scheduled game.');
    return matches[0];
  }
  const games = envelope.data;
  if (!Array.isArray(games)) throw new Error('Score source format changed.');
  const matches = games.filter(item => normalize(item.school) === normalize(schoolName)
    && normalize(item.opponent) === normalize(game.opponent));
  if (matches.length !== 1) throw new Error('Score source did not uniquely match the scheduled game.');
  return matches[0];
}

export function parseScore(payload, game, schoolName, previous, now = new Date()) {
  const envelope = typeof payload.d === 'string' ? JSON.parse(payload.d) : payload.d;
  if (!envelope?.success) throw new Error('Score source returned an unsuccessful response.');
  const result = findGameRow(envelope, game, schoolName);
  const label = String(result.status || '').trim();
  const status = /final/i.test(label) ? 'final'
    : /quarter|qtr|q[1-4]|1st|2nd|3rd|4th|half|\bot\b|delay|live/i.test(label) ? 'live'
    : /scheduled|[ap]\.?m\.?/i.test(label) ? 'scheduled' : null;
  if (!status) throw new Error(`Unrecognized game status: ${label}`);
  const numeric = value => value !== null && value !== undefined && String(value).trim() !== ''
    && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 200;
  if (status !== 'scheduled' && (!numeric(result.score) || !numeric(result.opponentScore))) {
    throw new Error('Invalid score; keeping the last verified result.');
  }
  const cainScore = Number(result.score);
  const opponentScore = Number(result.opponentScore);
  const sameGame = previous?.slug === gameSlug(game);
  if (sameGame && previous.status === 'final' && status !== 'final') return previous;
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
  return parseScore(JSON.parse(await response.text()), game, schoolName, previous);
}
