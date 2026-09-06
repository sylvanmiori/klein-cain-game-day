// Structural and editorial checks for content/editions/*.json.
// Runs before every build so a malformed or stale edition cannot ship.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'content/editions');
const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const publication = JSON.parse(await readFile(path.join(root, 'config/publication.json'), 'utf8'));

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

  for (const fact of edition.preview?.intro?.facts ?? []) {
    if (fact.team !== undefined && !['school', 'opponent'].includes(fact.team)) {
      fail(`intro fact "${fact.label}" has team "${fact.team}"; use "school" or "opponent"`);
    }
  }

  for (const row of edition.preview?.recruiting?.rows ?? []) {
    if (!row.href?.startsWith('https://')) fail(`recruiting row ${row.name} needs a public source link`);
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
console.log(`Validated ${files.length} edition file(s).`);
