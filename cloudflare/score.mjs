export function gameSlug(game) {
  return `${game.date}-${game.opponent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

export function activeGame(schedule, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const hour = Number(parts.hour);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  // Resume window: a postponed game can resume on a later date, outside the
  // normal evening window. An optional `resume: { date, startHour, endHour }`
  // on the schedule entry keeps the poller awake for it (Week 5 resumed Sat
  // 2026-10-03 10:00 AM CT after the 2026-10-01 weather postponement).
  for (const game of schedule) {
    const r = game?.resume;
    if (r && r.date === today
      && Number.isFinite(Number(r.startHour)) && Number.isFinite(Number(r.endHour))
      && hour >= Number(r.startHour) && hour < Number(r.endHour)) return game;
  }
  if (hour >= 2 && hour < 18) return null;
  const date = new Date(`${today}T12:00:00Z`);
  if (hour < 2) date.setUTCDate(date.getUTCDate() - 1);
  return schedule.find(game => game.date === date.toISOString().slice(0, 10)) || null;
}

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Linear-time removal of DCTF heavy fields. Avoids regex backtracking on multi-MB HTML. */
export function stripHeavyScoreFields(jsonText) {
  const parts = [];
  let kept = 0; // start of the not-yet-copied kept region
  let i = 0;
  const n = jsonText.length;
  const flush = (end) => {
    if (end > kept) parts.push(jsonText.slice(kept, end));
    kept = end;
  };
  const dropTrailingComma = () => {
    for (let k = parts.length - 1; k >= 0; k--) {
      const tail = parts[k];
      if (!tail) continue;
      if (tail.endsWith(',')) parts[k] = tail.slice(0, -1);
      return;
    }
  };
  while (i < n) {
    // Jump straight to the next string; only a string can start a heavy field.
    const q = jsonText.indexOf('"', i);
    if (q === -1) break;
    const isRender = jsonText.startsWith('"render":"', q);
    const isErrors = !isRender && jsonText.startsWith('"errorList":[', q);
    if (!isRender && !isErrors) {
      // Ordinary string (possibly containing text like `"render":` that must
      // be kept verbatim): skip to its closing quote.
      i = q + 1;
      while (i < n) {
        const c = jsonText[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    // Heavy field: copy everything before it, then drop the field plus exactly
    // one separator comma (the following one when present, else the preceding).
    flush(q);
    let j = q + (isRender ? '"render":"'.length : '"errorList":['.length);
    if (isRender) {
      while (j < n) {
        const c = jsonText[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '"') { j += 1; break; }
        j += 1;
      }
    } else {
      let depth = 1;
      while (j < n && depth > 0) {
        const c = jsonText[j];
        if (c === '"') {
          j += 1;
          while (j < n) {
            const d = jsonText[j];
            if (d === '\\') { j += 2; continue; }
            if (d === '"') { j += 1; break; }
            j += 1;
          }
          continue;
        }
        if (c === '[') depth += 1;
        else if (c === ']') depth -= 1;
        j += 1;
      }
    }
    if (jsonText[j] === ',') j += 1;
    else dropTrailingComma();
    kept = j;
    i = j;
  }
  flush(n);
  return parts.join('');
}

/**
 * Pull only the top-level row objects whose `school` field matches, never
 * JSON.parse the full games array. A linear brace-matching scan (string
 * aware), so rows that gain nested objects in a DCTF shape change still
 * extract; anything unrecognized fails closed in the unique-match check below.
 */
export function extractSchoolGames(dataText, schoolName) {
  const nameJson = JSON.stringify(schoolName);
  const rows = [];
  const stack = [];
  let i = 0;
  const n = dataText.length;
  while (i < n) {
    const c = dataText[i];
    if (c === '"') {
      i += 1;
      while (i < n) {
        const d = dataText[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '{') { stack.push(i); i += 1; continue; }
    if (c === '}') {
      const start = stack.pop();
      // Only array-level rows are candidates, never nested objects.
      if (start !== undefined && stack.length === 0) {
        const text = dataText.slice(start, i + 1);
        if (text.includes('"school"') && text.includes(nameJson)) {
          try {
            const obj = JSON.parse(text);
            if (obj && obj.school === schoolName) rows.push(obj);
          } catch {
            // Skip malformed candidates; the unique-match check fails closed.
          }
        }
      }
      i += 1;
      continue;
    }
    i += 1;
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
  // flat row(s), never JSON.parse the full slimmed array (still ~537KB / 1100 rows).
  let data = envelope.data;
  if (typeof data === 'string') data = stripHeavyScoreFields(data);
  const matches = matchGames(data, schoolName, game.opponent);
  if (matches.length !== 1) throw new Error('Score source did not uniquely match the scheduled game.');
  const result = matches[0];
  const label = String(result.status || '').trim();
  const status = /final/i.test(label) ? 'final'
    : /quarter|qtr|q[1-4]|1st|2nd|3rd|4th|half|\bbot\b|delay|live/i.test(label) ? 'live'
    : /scheduled|[ap]\.?m\.?/i.test(label) ? 'scheduled' : null;
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
    source: 'Dave Campbell’s Texas Football', sourceUrl: 'https://www.davecampbells.com/',
  };
}

/** Hard ceiling on the raw DCTF response body. Bounds memory and CPU before parsing. */
export const MAX_SCORE_PAYLOAD_BYTES = 8_000_000;


/** Unauthenticated DCTF game detail. Prefer this over scoresGetJson (401). */
export async function fetchPublicDctfGame(gameId) {
  const url = `https://www.davecampbells.com/api/public/games/${gameId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    redirect: 'manual',
  });
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new Error(`DCTF public game redirected (${response.status})`);
  }
  if (!response.ok) throw new Error(`DCTF public game HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_SCORE_PAYLOAD_BYTES) throw new Error('DCTF public game payload too large.');
  if (text.trimStart().startsWith('<')) throw new Error('DCTF public game returned HTML');
  return JSON.parse(text);
}

/**
 * Map DCTF public game payload into our score card.
 * Always key scores by school name vs our schedule home flag — DCTF participantType
 * can disagree with venue home/away.
 */
export function parsePublicDctfGame(payload, game, schoolName, previous, now = new Date()) {
  if (!payload?.success || !payload.data) throw new Error('DCTF public game unsuccessful');
  const data = payload.data;
  const parts = Array.isArray(data.participants) ? data.participants : [];
  const ours = parts.find(p => normalize(p.schoolName) === normalize(schoolName));
  const opp = parts.find(p => normalize(p.schoolName) === normalize(game.opponent));
  if (!ours || !opp) throw new Error('DCTF public game missing school participants');
  const labelRaw = String(data.status || data.gameState || data.eventDescription || '').trim();
  const status = /final/i.test(labelRaw) ? 'final'
    : /live|quarter|qtr|q[1-4]|1st|2nd|3rd|4th|half|delay|progress/i.test(labelRaw) ? 'live'
    : /scheduled|upcoming/i.test(labelRaw) ? 'scheduled' : null;
  if (!status) throw new Error(`Unrecognized DCTF public status: ${labelRaw}`);
  const numeric = value => value !== null && value !== undefined && String(value).trim() !== ''
    && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 200;
  if (status !== 'scheduled' && (!numeric(ours.score) || !numeric(opp.score))) {
    throw new Error('Invalid public DCTF score; keeping the last verified result.');
  }
  let cainScore = Number(ours.score);
  let opponentScore = Number(opp.score);
  const sameGame = previous?.slug === gameSlug(game);
  if (sameGame && previous.status === 'final' && status !== 'final') return previous;
  if (sameGame && previous && previous.status !== 'scheduled' && status === 'live'
    && Number.isInteger(previous.homeScore) && Number.isInteger(previous.awayScore)) {
    const prevCain = game.home ? previous.homeScore : previous.awayScore;
    const prevOpp = game.home ? previous.awayScore : previous.homeScore;
    if (cainScore < prevCain || opponentScore < prevOpp) {
      cainScore = prevCain;
      opponentScore = prevOpp;
    }
  }
  const statusLabel = status === 'scheduled' ? game.kickoff
    : (/^live$/i.test(labelRaw) ? 'Live' : labelRaw);
  return {
    schemaVersion: 1, slug: gameSlug(game), status,
    statusLabel,
    homeScore: status === 'scheduled' ? null : game.home ? cainScore : opponentScore,
    awayScore: status === 'scheduled' ? null : game.home ? opponentScore : cainScore,
    homeRecord: sameGame ? previous.homeRecord : '',
    awayRecord: sameGame ? previous.awayRecord : '',
    updatedAt: now.toISOString(),
    source: 'Dave Campbell’s Texas Football',
    sourceUrl: `https://www.davecampbells.com/game/${data.gameScheduleId || game.dctfGameId}`,
  };
}

export async function fetchGameScore(game, schoolName, previous) {
  let publicErr = null;
  // Prefer the unauthenticated public game detail when we have a DCTF id.
  if (game.dctfGameId) {
    try {
      const publicPayload = await fetchPublicDctfGame(game.dctfGameId);
      return parsePublicDctfGame(publicPayload, game, schoolName, previous);
    } catch (err) {
      // Fall through to the legacy board endpoints / manual file.
      publicErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  const [year, month, day] = game.date.split('-');
  // texasfootball.com 301s the whole host to davecampbells.com (HTML), which
  // made JSON.parse throw DOCTYPE errors and froze the feed on 2026-10-01.
  // Hit the new host directly. It currently returns 401 without a session;
  // that still throws so the Worker falls through to the live-data manual file.
  const endpoints = [
    'https://www.davecampbells.com/api/schools/scoresGetJson',
    'https://www.texasfootball.com/api/schools/scoresGetJson',
  ];
  let raw = null;
  let lastErr = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ gameDate: `${month}/${day}/${year}`, schTypeTagId: 1, classConfTagId: -1, statusId: -1 }),
        signal: AbortSignal.timeout(15000),
        // Workers edge only allows redirect "follow" | "manual" ("error" throws
        // before fetch and skipped the manual live-data fallback on 2026-10-01).
        redirect: 'manual',
      });
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        lastErr = new Error(`Score source redirected (${response.status}) at ${endpoint}`);
        continue;
      }
      if (!response.ok) {
        lastErr = new Error(`Score source HTTP ${response.status} at ${endpoint}`);
        continue;
      }
      const text = await response.text();
      if (text.length > MAX_SCORE_PAYLOAD_BYTES) throw new Error('Score source payload too large.');
      if (text.trimStart().startsWith('<')) {
        lastErr = new Error(`Score source returned HTML at ${endpoint}`);
        continue;
      }
      raw = text;
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  if (raw == null) throw lastErr || publicErr || new Error('Score source unavailable');
  return parseScore(JSON.parse(raw), game, schoolName, previous);
}
