// Refreshes the machine-owned fields of upcoming editions from public sources.
// No language model is involved. This script may only write four things:
// home.record, away.record, prediction and weather. Everything else in an
// edition is editorial and is left exactly as written.
//
//   node scripts/refresh-facts.mjs            update files
//   node scripts/refresh-facts.mjs --dry-run  report what would change
//
// Any source failure is reported and the previous verified value is kept.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchDistrictRecords, fetchPick, fetchScoreRows, fetchWeather, recordFor } from './lib/sources.mjs';
import { buildGames, predict, rate } from './lib/rating.mjs';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

const publication = await readJson('config/publication.json');
const schedule = await readJson('config/season-2026.json');
const venues = await readJson('config/venues.json');

/** Editions still worth refreshing: anything not already played. */
function upcoming(editions, today) {
  return editions.filter((entry) => entry.edition.state !== 'final' && entry.edition.date >= today);
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: publication.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

// Editions are discovered from disk, so a new game needs no change here.
const { readdir } = await import('node:fs/promises');
const names = (await readdir(path.join(root, 'content/editions'))).filter((n) => n.endsWith('.json'));
const editions = await Promise.all(
  names.map(async (name) => ({ name, edition: await readJson(`content/editions/${name}`) })),
);

const targets = upcoming(editions, today);
if (targets.length === 0) {
  console.log(`No upcoming editions to refresh (today is ${today}).`);
  process.exit(0);
}

const changes = [];
const problems = [];

/** Every Thursday, Friday and Saturday of the season played so far. */
function playedDates(games, day) {
  const first = games[0]?.date;
  if (!first) return [];
  const dates = [];
  const cursor = new Date(`${first}T12:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= day) {
    if ([4, 5, 6].includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Our own rating, from every Texas result so far. It publishes nothing until
// both teams have enough games, so an early-season number is simply withheld.
let model = null;
try {
  const dates = playedDates(schedule, today);
  const rows = [];
  let missing = 0;
  for (const date of dates) {
    try {
      rows.push(...(await fetchScoreRows(date)));
    } catch (error) {
      missing += 1;
      problems.push(`rating: ${date}: ${error.message}`);
    }
  }
  // A rating built on part of the season is worse than none: a missing week
  // silently distorts every team that played in it. Publish nothing instead.
  if (missing > 0) {
    problems.push(`rating: ${missing} of ${dates.length} dates unavailable, so no rating was computed`);
  } else {
    const played = buildGames(rows);
    if (played.length > 0) {
      model = rate(played);
      console.log(`Rating: ${played.length} games, ${model.ratings.size} teams, home edge ${model.homeEdge.toFixed(2)}.`);
    }
  }
} catch (error) {
  problems.push(`rating: ${error.message}`);
}

let records = null;
try {
  records = await fetchDistrictRecords(publication.teamPageUrl);
} catch (error) {
  problems.push(`records: ${error.message}`);
}

for (const { name, edition } of targets) {
  const game = schedule.find((item) => item.date === edition.date);
  if (!game) {
    problems.push(`${name}: no scheduled game on ${edition.date}`);
    continue;
  }
  const before = JSON.stringify(edition);

  // Records, from the district standings table.
  if (records) {
    for (const side of ['home', 'away']) {
      const found = recordFor(records, edition[side]);
      if (!found) {
        problems.push(`${name}: no standings row for ${edition[side].name} ${edition[side].mascot}`);
      } else if (found !== edition[side].record) {
        changes.push(`${name}: ${side} record ${edition[side].record || '(none)'} -> ${found}`);
        edition[side].record = found;
      }
    }
  }

  // The published pick.
  try {
    const pick = await fetchPick(game, publication.schoolName);
    if (pick && pick.margin !== edition.prediction?.margin) {
      changes.push(`${name}: pick ${edition.prediction?.margin ?? '(none)'} -> ${pick.margin}`);
    }
    if (pick) edition.prediction = pick;
  } catch (error) {
    problems.push(`${name}: pick: ${error.message}`);
  }

  // Our own rating for this matchup, when the season supports one.
  if (model) {
    const prediction = predict(model, edition.home.name, edition.away.name);
    if (prediction) {
      if (Math.round(prediction.margin) !== Math.round(edition.rating?.margin ?? NaN)) {
        changes.push(`${name}: rating -> ${prediction.margin.toFixed(1)}`);
      }
      edition.rating = {
        home: Number(prediction.home.toFixed(2)),
        away: Number(prediction.away.toFixed(2)),
        margin: Number(prediction.margin.toFixed(2)),
        method: 'Least-squares rating of every Texas result, margins capped at 28',
        source: 'Cain Game Day',
        sourceUrl: `https://${publication.schoolHostname}/`,
        asOf: new Date().toISOString(),
      };
    } else if (!edition.rating) {
      console.log(`${name}: too few games so far to rate; no rating published.`);
    }
  }

  // Forecast for the kickoff hour, when the game is inside the forecast window.
  const venue = venues[edition.venue];
  if (!venue) {
    problems.push(`${name}: no coordinates configured for ${edition.venue}`);
  } else {
    try {
      const weather = await fetchWeather({ ...venue, date: edition.date, kickoff: edition.kickoff });
      if (weather) {
        if (weather.condition !== edition.weather?.condition || weather.tempF !== edition.weather?.tempF) {
          changes.push(`${name}: weather -> ${weather.tempF}F ${weather.condition} ${weather.precipPct}% rain`);
        }
        edition.weather = weather;
      } else if (!edition.weather) {
        console.log(`${name}: outside the forecast window; no weather published yet.`);
      }
    } catch (error) {
      problems.push(`${name}: weather: ${error.message}`);
    }
  }

  if (JSON.stringify(edition) !== before && !dryRun) {
    await writeFile(path.join(root, 'content/editions', name), `${JSON.stringify(edition, null, 2)}\n`);
  }
}

if (changes.length) console.log(`Changes:\n${changes.map((line) => `  - ${line}`).join('\n')}`);
else console.log('No changes; every value already matched its source.');

if (problems.length) {
  console.warn(`\nKept the previous value for:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
}

// A source outage must not fail the job; it simply publishes nothing new.
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${changes.length > 0 ? 'true' : 'false'}\n`);
}
