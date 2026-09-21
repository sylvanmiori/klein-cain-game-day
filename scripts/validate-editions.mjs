// Structural and editorial checks for content/editions/*.json.
// Runs before every build so a malformed or stale edition cannot ship.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { detectLowQualityCaption } from './lib/caption-helper.mjs';

const root = process.cwd();
const dir = path.join(root, 'content/editions');
const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const publication = JSON.parse(await readFile(path.join(root, 'config/publication.json'), 'utf8'));
const coaches = JSON.parse(await readFile(path.join(root, 'config/coaches.json'), 'utf8'));
const coachBios = [
  coaches.school?.bio,
  ...Object.values(coaches.opponents ?? {}).map((c) => c.bio),
].filter(Boolean);

const problems = [];
const files = (await readdir(dir)).filter((name) => name.endsWith('.json')).sort();
const editions = [];

for (const file of files) {
  const where = `content/editions/${file}`;
  const fail = (message) => problems.push(`${where}: ${message}`);
  let edition;
  try {
    edition = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
  } catch (error) {
    fail(`is not valid JSON (${error.message})`);
    continue;
  }
  editions.push({ file, edition, fail });

  const required = [
    'schemaVersion', 'slug', 'week', 'issue', 'state', 'date', 'dateLong', 'dateShort', 'kickoff',
    'venue', 'event', 'updated', 'home', 'away', 'pageTitle', 'metaTitle', 'metaDescription',
    'socialDescription', 'ogImage', 'prediction', 'weather', 'scheduledFacts', 'resultFacts',
    'preview', 'final', 'finalScore', 'rating', 'massey', 'rankings', 'stats', 'sources', 'footerNote', 'disclaimerEntities', 'current',
  ];
  for (const key of required) if (!(key in edition)) fail(`is missing "${key}"`);

  if (edition.schemaVersion !== 2) fail('must use schemaVersion 2');
  if ('recapNotes' in edition && edition.recapNotes !== null) {
    if (!Array.isArray(edition.recapNotes)) fail('recapNotes must be an array of strings or null');
    for (const [index, note] of edition.recapNotes.entries()) {
      if (typeof note !== 'string' || !note.trim()) fail(`recapNotes[${index}] must be a non-empty string`);
    }
  }
  if (!['preview', 'final'].includes(edition.state)) fail('state must be "preview" or "final"');
  if (file !== `${edition.slug}.json`) fail(`filename must match the slug (${edition.slug}.json)`);

  const game = schedule.find((item) => item.date === edition.date);
  if (!game) {
    fail(`date ${edition.date} is not on the season schedule`);
  } else {
    // The schedule is the authority on who plays whom and where.
    const school = publication.schoolName;
    const expectedHome = game.home ? school : game.opponent;
    const expectedAway = game.home ? game.opponent : school;
    if (edition.home?.name !== expectedHome) fail(`home team should be ${expectedHome}, not ${edition.home?.name}`);
    if (edition.away?.name !== expectedAway) fail(`away team should be ${expectedAway}, not ${edition.away?.name}`);
    if (edition.venue !== game.venue) fail(`venue should be ${game.venue}`);
    if (edition.kickoff !== game.kickoff) fail(`kickoff should be ${game.kickoff}`);
  }

  // No opponent from another week may survive anywhere in this file.
  const opponent = edition.home?.name === publication.schoolName ? edition.away?.name : edition.home?.name;
  const opponentTeam = edition.home?.name === opponent ? edition.home : edition.away;
  if (opponentTeam?.logo?.includes('placeholder')) fail(`${opponent} still uses a placeholder logo`);
  for (const team of [edition.home, edition.away]) {
    if (!String(team?.logo || '').startsWith('/')) {
      fail(`${team?.name || 'team'} logo must be a local public path`);
      continue;
    }
    try {
      await readFile(path.join(root, 'public', team.logo.slice(1)));
    } catch {
      fail(`${team.name} logo does not exist at public${team.logo}`);
    }
  }
  const body = JSON.stringify(edition);
  for (const other of schedule) {
    if (other.opponent === opponent || other.date === edition.date) continue;
    if (new RegExp(`"[^"]*\\b${other.opponent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(body)) {
      // Naming a past or future opponent is legitimate in prose, so only the
      // page's own identifying fields are treated as an error.
      for (const key of ['pageTitle', 'metaTitle', 'metaDescription', 'socialDescription']) {
        // Several schedule opponents are prefixes of others ("Klein" of
        // "Klein Cain", "Magnolia" of "Magnolia West"), so this edition's own
        // two team names are removed before the check runs.
        const text = String(edition[key] ?? '')
          .replaceAll(publication.schoolName, '')
          .replaceAll(opponent ?? '', '');
        if (new RegExp(`\\b${other.opponent}\\b`, 'i').test(text)) {
          fail(`${key} still names a different opponent (${other.opponent})`);
        }
      }
    }
  }

  // The slug must be derived from the schedule, matching cloudflare/score.mjs
  // so an edition and its live score always share one key.
  if (game) {
    const expectedSlug = `${game.date}-${game.opponent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    if (edition.slug !== expectedSlug) fail(`slug should be ${expectedSlug}`);
  }

  // Machine-owned fields must carry their attribution, so nothing reaches the
  // page without a named source the reader can check.
  const attributed = (value, label, extra = () => true) => {
    if (value === null || value === undefined) return;
    if (!value.source) fail(`${label} is missing a source name`);
    if (!String(value.sourceUrl || '').startsWith('https://')) fail(`${label} is missing an https sourceUrl`);
    if (!Number.isFinite(Date.parse(value.asOf))) fail(`${label} is missing a valid asOf timestamp`);
    extra(value);
  };
  attributed(edition.prediction, 'prediction', (pick) => {
    if (!Number.isInteger(pick.margin)) fail('prediction.margin must be an integer');
  });
  attributed(edition.finalScore, 'finalScore', (score) => {
    for (const side of ['home', 'away']) {
      if (!Number.isInteger(score[side])) fail(`finalScore.${side} must be an integer`);
    }
  });
  attributed(edition.rating, 'rating', (rating) => {
    if (!Number.isFinite(rating.margin)) fail('rating.margin must be a number');
    if (!rating.method) fail('rating.method must state how the number was produced');
    if (rating.source === 'Massey' || /massey/i.test(rating.source || '')) {
      fail('our rating must never be attributed to Massey');
    }
  });
  attributed(edition.stats, 'stats', (stats) => {
    if (!Array.isArray(stats.leaders) || stats.leaders.length === 0) {
      fail('stats has no leaders; omit the section rather than shipping it empty');
    }
    for (const leader of stats.leaders ?? []) {
      if (!leader.name || !leader.category || leader.value === undefined) {
        fail(`stat leader ${leader.name || '?'} is missing a name, category or value`);
      }
    }
    if (!Number.isFinite(Date.parse(stats.updated))) fail('stats.updated must say when the source was updated');
  });
  attributed(edition.gameStats, 'gameStats', (stats) => {
    if (!stats.team) fail('gameStats must name the team');
    if (!stats.playerOfGame?.name || !stats.playerOfGame?.number || !stats.playerOfGame?.headline
      || !stats.playerOfGame?.rationale || !stats.playerOfGame?.model) {
      fail('gameStats has an incomplete player-of-the-game selection');
    }
    if (stats.playerOfGame?.image && !/^\/players\/[a-z0-9-]+\.jpg$/.test(stats.playerOfGame.image)) {
      fail('gameStats.playerOfGame.image must be a local player portrait');
    }
    if (!Array.isArray(stats.totals) || stats.totals.length === 0) fail('gameStats has no team totals');
    if (!Array.isArray(stats.leaders) || stats.leaders.length === 0) fail('gameStats has no leaders');
    if (!Number.isFinite(Date.parse(stats.updated))) fail('gameStats.updated must be a valid source timestamp');
    for (const leader of stats.leaders ?? []) {
      if (!leader.category || !leader.name || !leader.stat) fail('gameStats has an incomplete leader');
    }
  });
  attributed(edition.weather, 'weather', (weather) => {
    if (!Number.isFinite(weather.tempF)) fail('weather.tempF must be a number');
    if (!weather.condition) fail('weather.condition must say what the forecast is');
  });

  // A game must always carry a prediction from some source.
  if (!edition.finalScore && !(edition.rating || edition.massey || edition.prediction)) {
    fail('has no prediction; one of rating, massey or prediction is required before kickoff');
  }

  if (edition.state === 'final' && !edition.final) fail('state is "final" but there is no final section');
  if (edition.state === 'preview' && edition.final) fail('state is "preview" but a final section is present');
  if (!edition.preview && !edition.final) fail('has neither a preview nor a final section');

  // A preview that renders nothing would publish a heading over an empty page.
  if (edition.preview) {
    const filled = edition.preview.players?.length > 0 || edition.preview.intro
      || edition.preview.recruiting || edition.preview.keys || edition.preview.gameInfo;
    if (!filled) fail('preview has no players and no other section; it would render an empty page');
  }

  if (edition.final) {
    for (const key of ['homeScore', 'awayScore']) {
      const value = edition.final[key];
      if (value !== null && !Number.isInteger(value)) fail(`final.${key} must be an integer or null`);
    }
    // Postgame player claims need verified statistics behind them.
    for (const leader of edition.final.leaders?.items ?? []) {
      if (!leader.stat || !leader.detail) fail(`final leader ${leader.name} is missing a verified stat line`);
      if (!edition.final.leaders.source) fail('final leaders must name the box score they came from');
    }
    // Recap commentary must be woven directly into final.body in a journalistic style, never isolated in an "Extra" block.
    for (const note of edition.final.notes ?? []) {
      if (/^extra$/i.test(note.heading?.trim() ?? '')) {
        fail('do not publish notes under "Extra"; weave commentary directly into the recap body (final.body)');
      }
    }
    // Quotes and commentary must be attributed as statements to reporters / Game Day desk, never assumed to be speeches to the team.
    if (edition.final.body && /\btold\s+the\s+(?:team|players|squad|locker\s*room)\b/i.test(edition.final.body)) {
      fail('recap body must not assume quotes were delivered to the team ("told the team"); attribute quotes as statements to reporters or Game Day (e.g. "[Name] said" or "[Name] said before kickoff")');
    }
  }

  for (const player of edition.preview?.players ?? []) {
    for (const key of ['team', 'number', 'name', 'image', 'role', 'tag', 'rating', 'copy']) {
      if (typeof player[key] !== 'string') fail(`player ${player.name || '?'} is missing "${key}"`);
    }
    if (player.image && !player.image.startsWith('/')) {
      fail(`player ${player.name} image must be a root-relative path`);
    }
    // A rating field must either carry a value or say plainly that none exists.
    if (!player.rating.trim()) fail(`player ${player.name} has an empty rating; label it "Not listed" instead`);
  }

  // Current preview capsules are editorial rather than machine-owned. Require
  // a recent, team-by-team audit so automated records/ranks cannot make an old
  // player section look current. Two days covers the normal pregame workflow.
  const playerStatsAudit = edition.preview?.playerStatsAudit;
  if (edition.state === 'preview' && edition.current && (edition.preview?.players?.length ?? 0) > 0) {
    if (!playerStatsAudit) {
      fail('current preview players require a playerStatsAudit');
    } else {
      const auditDate = new Date(`${playerStatsAudit.asOf}T00:00:00Z`);
      const gameDate = new Date(`${edition.date}T00:00:00Z`);
      if (!Number.isFinite(auditDate.valueOf())) fail('playerStatsAudit needs a valid asOf date');
      const today = process.env.VALIDATE_TODAY ?? new Intl.DateTimeFormat('en-CA', {
        timeZone: publication.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const todayDate = new Date(`${today}T12:00:00Z`);
      const daysUntilKickoff = (gameDate - todayDate) / 86_400_000;
      // Promotion Monday can make a preview current before the final pregame refresh.
      // Enforce the two-day audit window only once kickoff is that close.
      if (daysUntilKickoff <= 2 && (gameDate - auditDate) / 86_400_000 > 2) {
        fail('playerStatsAudit must be completed within two days of kickoff');
      }
      if (!Array.isArray(playerStatsAudit.sources) || playerStatsAudit.sources.length < 2) {
        fail('playerStatsAudit must include a source for both teams');
      }
      for (const source of playerStatsAudit.sources ?? []) {
        if (!source.team || !Number.isInteger(source.games) || source.games < 1 || !source.source
          || !source.sourceUrl?.startsWith('https://') || !Number.isFinite(Date.parse(source.sourceUpdated))) {
          fail('each playerStatsAudit source needs a team, games count, source, https URL and sourceUpdated timestamp');
        }
      }
      for (const team of [edition.home?.name, edition.away?.name]) {
        if (!playerStatsAudit.sources?.some((source) => source.team === team)) {
          fail(`playerStatsAudit has no source for ${team}`);
        }
      }
    }
  }

  // Preview intro body must not copy coach bio sentences verbatim from coaches.json.
  // The Head coaches section already presents each coach's bio, record and career stops.
  if (edition.preview?.intro?.body) {
    for (const bio of coachBios) {
      const sentences = bio.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
      for (const sentence of sentences) {
        if (edition.preview.intro.body.includes(sentence)) {
          fail(`preview.intro.body duplicates coach bio sentence verbatim: "${sentence}"`);
        }
      }
    }
  }

  for (const fact of edition.preview?.intro?.facts ?? []) {
    if (fact.team !== undefined && !['school', 'opponent'].includes(fact.team)) {
      fail(`intro fact "${fact.label}" has team "${fact.team}"; use "school" or "opponent"`);
    }
  }

  for (const row of edition.preview?.recruiting?.rows ?? []) {
    if (!row.href?.startsWith('https://')) fail(`recruiting row ${row.name} needs a public source link`);
  }

  // A full opponent-player section must be based on a roster-wide recruiting
  // check, not just searches for the players an editor already happened to
  // select. Every commitment found in that check is prime matchup context and
  // must appear in Players to watch with the school named prominently.
  const opponentPlayers = (edition.preview?.players ?? []).filter(
    (player) => player.team.toLowerCase() !== 'cain',
  );
  const recruitingAudit = edition.preview?.opponentRecruitingAudit;
  if (opponentPlayers.length > 0 && !recruitingAudit) {
    fail('opponent players require an opponentRecruitingAudit covering the full roster');
  }
  if (recruitingAudit) {
    if (!recruitingAudit.source) fail('opponentRecruitingAudit needs a source name');
    if (!recruitingAudit.sourceUrl?.startsWith('https://')) {
      fail('opponentRecruitingAudit needs an https sourceUrl');
    }
    if (!Number.isFinite(Date.parse(recruitingAudit.asOf))) {
      fail('opponentRecruitingAudit needs a valid asOf timestamp');
    }
    if (!Array.isArray(recruitingAudit.committedPlayers)) {
      fail('opponentRecruitingAudit.committedPlayers must be an array');
    }
    if (!Array.isArray(recruitingAudit.eliteProspects)) {
      fail('opponentRecruitingAudit.eliteProspects must be an array');
    }
    for (const commitment of recruitingAudit.committedPlayers ?? []) {
      if (!commitment.name || !commitment.school || !commitment.sourceUrl?.startsWith('https://')) {
        fail('every audited opponent commitment needs a player, college and https source');
        continue;
      }
      const player = opponentPlayers.find(
        (candidate) => candidate.name.toLowerCase() === commitment.name.toLowerCase(),
      );
      if (!player) {
        fail(`${commitment.name}, a verified ${commitment.school} commit, is missing from Players to watch`);
        continue;
      }
      const capsule = `${player.tag} ${player.rating} ${player.copy}`;
      if (!/commit/i.test(capsule) || !capsule.toLowerCase().includes(commitment.school.toLowerCase())) {
        fail(`${commitment.name}'s player capsule must prominently say ${commitment.school} commit`);
      }
      const row = (edition.preview?.recruiting?.rows ?? []).find(
        (candidate) => candidate.name.toLowerCase() === commitment.name.toLowerCase(),
      );
      if (!row || !/commit/i.test(row.note) || !row.note.toLowerCase().includes(commitment.school.toLowerCase())) {
        fail(`${commitment.name}'s recruiting note must say ${commitment.school} commit`);
      }
    }
    for (const prospect of recruitingAudit.eliteProspects ?? []) {
      if (!prospect.name || !prospect.source || !prospect.sourceUrl?.startsWith('https://')
        || !Number.isInteger(prospect.classYear) || !Number.isInteger(prospect.positionRank)
        || (prospect.nationalRank !== null && !Number.isInteger(prospect.nationalRank))) {
        fail('every audited elite prospect needs a player, source, class, position rank and https source');
        continue;
      }
      if (prospect.positionRank > 10 && (prospect.nationalRank === null || prospect.nationalRank > 100)) {
        fail(`${prospect.name} is not top 10 at a position or top 100 nationally; do not label the player elite`);
      }
      const player = opponentPlayers.find(
        (candidate) => candidate.name.toLowerCase() === prospect.name.toLowerCase(),
      );
      if (!player) {
        fail(`${prospect.name}, an audited elite prospect, is missing from Players to watch`);
        continue;
      }
      const capsule = `${player.tag} ${player.rating} ${player.copy}`.toLowerCase();
      const rankPattern = new RegExp(`(?:no\\.\\s*|#)${prospect.positionRank}\\b`, 'i');
      if (!capsule.includes(prospect.source.toLowerCase()) || !rankPattern.test(capsule)
        || !capsule.includes(String(prospect.classYear))) {
        fail(`${prospect.name}'s player capsule must foreground the ${prospect.source} position rank and class`);
      }
      const row = (edition.preview?.recruiting?.rows ?? []).find(
        (candidate) => candidate.name.toLowerCase() === prospect.name.toLowerCase(),
      );
      if (!row || !row.note.toLowerCase().includes(prospect.source.toLowerCase())
        || !rankPattern.test(row.note) || !row.note.includes(String(prospect.classYear))) {
        fail(`${prospect.name}'s recruiting note must state the ${prospect.source} position rank and class`);
      }
    }
  }

  for (const source of edition.sources ?? []) {
    if (!source.href?.startsWith('https://')) fail(`source "${source.label}" needs an https URL`);
  }

  if (!Array.isArray(edition.disclaimerEntities) || edition.disclaimerEntities.length === 0) {
    fail('disclaimerEntities must name every organization on the page');
  } else if (opponent && !edition.disclaimerEntities.some((entity) => entity.includes(opponent))) {
    fail(`disclaimerEntities does not mention ${opponent}`);
  }
}

// Without this the season would quietly stop producing pages once it passed
// the last edition anyone had created.
for (const game of schedule) {
  if (!editions.some(({ edition }) => edition.date === game.date)) {
    problems.push(`no edition for the ${game.date} game against ${game.opponent}; run "npm run editions"`);
  }
}

const current = editions.filter(({ edition }) => edition.current);
if (current.length !== 1) {
  problems.push(`exactly one edition must set "current": true (found ${current.length})`);
}

const weeks = new Set();
for (const { edition, fail } of editions) {
  if (weeks.has(edition.week)) fail(`week ${edition.week} is used by more than one edition`);
  weeks.add(edition.week);
}

if (problems.length) {
  console.error(`Edition validation failed:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}

const galleryDir = path.join(root, 'content/galleries');
let galleryFiles = [];
try {
  galleryFiles = (await readdir(galleryDir)).filter((name) => name.endsWith('.json'));
} catch {
  galleryFiles = [];
}
const uses = ['lead', 'recap', 'home', 'thumb'];
for (const file of galleryFiles) {
  const where = `content/galleries/${file}`;
  const fail = (message) => problems.push(`${where}: ${message}`);
  let gallery;
  try {
    gallery = JSON.parse(await readFile(path.join(galleryDir, file), 'utf8'));
  } catch (error) {
    fail(`is not valid JSON (${error.message})`);
    continue;
  }
  if (file !== `${gallery.slug}.json`) fail(`filename must match the slug (${gallery.slug}.json)`);
  if (!editions.some(({ edition }) => edition.slug === gallery.slug)) fail(`slug ${gallery.slug} does not match an edition`);
  if (!gallery.credit || !String(gallery.galleryUrl || '').startsWith('https://')) fail('needs a credit and an https gallery URL');
  if (!Array.isArray(gallery.photos) || gallery.photos.length === 0) fail('needs at least one photo');
  const seen = { home: 0, thumb: 0, lead: 0 };
  for (const [index, photo] of gallery.photos.entries()) {
    if (!photo.alt || !photo.caption) fail(`photos[${index}] needs alt text and a caption`);
    const captionIssue = detectLowQualityCaption(photo.caption);
    if (captionIssue) {
      fail(`photos[${index}] caption uses generic jersey placeholder "${captionIssue}"; identify players by name and position using content/roster-2026.json`);
    }
    const altIssue = detectLowQualityCaption(photo.alt);
    if (altIssue) {
      fail(`photos[${index}] alt uses generic jersey placeholder "${altIssue}"; identify players by name and position using content/roster-2026.json`);
    }
    if (!String(photo.src || '').startsWith('/photos/')) fail(`photos[${index}] must use a local /photos/ path`);
    else {
      try {
        await readFile(path.join(root, 'public', photo.src.slice(1)));
      } catch {
        fail(`photos[${index}] is missing at public${photo.src}`);
      }
    }
    for (const use of photo.use ?? []) {
      if (!uses.includes(use)) fail(`photos[${index}] has unknown use "${use}"`);
      if (use in seen) seen[use] += 1;
    }
  }
  if (seen.home !== 1) fail(`needs exactly one photo marked "home" (found ${seen.home})`);
  if (seen.thumb !== 1) fail(`needs exactly one photo marked "thumb" (found ${seen.thumb})`);
  if (seen.lead !== 1) fail(`needs exactly one photo marked "lead" (found ${seen.lead})`);
}

if (problems.length) {
  console.error(`Edition validation failed:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`Validated ${files.length} edition file(s) and ${galleryFiles.length} photo gallery file(s).`);
