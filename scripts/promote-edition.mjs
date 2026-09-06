// Advances the season: decides which edition the home page shows, keeps the
// live score card pointed at that game, and captures a final score once a game
// has been played.
//
//   node scripts/promote-edition.mjs            apply
//   node scripts/promote-edition.mjs --dry-run  report only
//
// The rule: the edition for the most recent game stays current for three days
// after kickoff, then the next upcoming edition takes over. A Friday game is
// therefore still on the home page through Monday and hands over on Tuesday.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DCTF_ATTRIBUTION, fetchGameStats, fetchScoreRows, fetchStatLeaders } from './lib/sources.mjs';
import { pickCurrent } from './lib/season.mjs';
import { composeRecap } from './lib/recap.mjs';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

const publication = await readJson('config/publication.json');
const schedule = await readJson('config/season-2026.json');
const roster = await readJson('content/roster-2026.json');

// PROMOTE_TODAY overrides the date, for rehearsing a handover or correcting one.
const today = process.env.PROMOTE_TODAY ?? new Intl.DateTimeFormat('en-CA', {
  timeZone: publication.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const names = (await readdir(path.join(root, 'content/editions'))).filter((name) => name.endsWith('.json'));
const editions = await Promise.all(
  names.map(async (name) => ({ name, edition: await readJson(`content/editions/${name}`) })),
);

const target = pickCurrent(editions.map((entry) => entry.edition), today);
if (!target) {
  console.error('No editions found.');
  process.exit(1);
}

const changes = [];
const problems = [];

// Capture a verified final score for any game that has been played, so a game
// still shows its result after it stops being the current edition.
for (const { name, edition } of editions) {
  if (edition.date > today || edition.finalScore) continue;
  const game = schedule.find((item) => item.date === edition.date);
  if (!game) continue;
  try {
    const rows = await fetchScoreRows(edition.date);
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const row = rows.find((item) => normalize(item.school) === normalize(publication.schoolName)
      && normalize(item.opponent).includes(normalize(game.opponent)));
    if (!row || !/final/i.test(String(row.status || ''))) continue;
    const forScore = Number(row.score);
    const againstScore = Number(row.opponentScore);
    if (!Number.isInteger(forScore) || !Number.isInteger(againstScore)) continue;
    const school = publication.schoolName;
    edition.finalScore = {
      home: edition.home.name === school ? forScore : againstScore,
      away: edition.home.name === school ? againstScore : forScore,
      ...DCTF_ATTRIBUTION,
      asOf: new Date().toISOString(),
    };
    changes.push(`${name}: captured final ${edition.finalScore.home}-${edition.finalScore.away}`);
  } catch (error) {
    problems.push(`${name}: final score: ${error.message}`);
  }
}

// Snapshot season statistics once a played game is actually reflected in them.
// The source enters a Friday game the next morning, so a snapshot taken on
// game night would describe the season before the game and quietly mislead.
// Only the most recently played game may take a snapshot. The source serves
// current season totals with no history, so backfilling an older game would
// describe it with statistics from games played after it.
const lastPlayed = editions
  .filter(({ edition }) => edition.finalScore && edition.date <= today)
  .sort((a, b) => a.edition.date.localeCompare(b.edition.date))
  .pop();

for (const { name, edition } of lastPlayed ? [lastPlayed] : []) {
  if (edition.stats) continue;
  try {
    const stats = await fetchStatLeaders(publication.statsUrl);
    if (stats.updated.slice(0, 10) <= edition.date) {
      console.log(`${name}: statistics not yet updated for this game; leaving them for tomorrow.`);
      continue;
    }
    edition.stats = stats;
    changes.push(`${name}: captured ${stats.leaders.length} season stat leaders`);
  } catch (error) {
    problems.push(`${name}: statistics: ${error.message}`);
  }
}

// Game-only statistics have their own historical page, so unlike the season
// totals above they can safely be captured for every completed game. A missing
// team block means the coaches have not entered stats yet; keep retrying rather
// than publishing zeroes. Once captured, retry for three days so corrections
// made shortly after the first upload are picked up.
for (const { name, edition } of editions) {
  if (!edition.finalScore || edition.date > today) continue;
  const ageDays = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${edition.date}T12:00:00Z`)) / 86400000);
  if (edition.gameStats && ageDays > 3) continue;
  try {
    const gameStats = await fetchGameStats({
      scheduleUrl: publication.maxPrepsScheduleUrl,
      date: edition.date,
      teamId: publication.maxPrepsTeamId,
      teamName: publication.schoolName,
      roster: roster.players,
    });
    if (!gameStats) {
      console.log(`${name}: game statistics not posted yet; leaving them for the next run.`);
      continue;
    }
    if (gameStats.updated.slice(0, 10) <= edition.date) {
      console.log(`${name}: game statistics predate the final; leaving them for the next run.`);
      continue;
    }
    if (edition.gameStats?.updated === gameStats.updated) continue;
    edition.gameStats = gameStats;
    changes.push(`${name}: captured ${gameStats.totals.length} game totals and ${gameStats.leaders.length} leaders`);
  } catch (error) {
    problems.push(`${name}: game statistics: ${error.message}`);
  }
}

// Compose a recap for any played game that does not have one. Existing
// authored recaps are left alone.
for (const { name, edition } of editions) {
  if (!edition.finalScore || edition.final) continue;
  const recap = composeRecap({
    edition,
    editions: editions.map((entry) => entry.edition),
    schoolName: publication.schoolName,
    desk: publication.desk,
    siteName: publication.siteName,
  });
  if (!recap) continue;
  const { titles, ...final } = recap;
  edition.final = final;
  edition.state = 'final';
  Object.assign(edition, titles);
  changes.push(`${name}: wrote recap "${recap.headline}"`);
}

// Exactly one edition is current.
for (const { name, edition } of editions) {
  const shouldBeCurrent = edition.slug === target.slug;
  if (edition.current !== shouldBeCurrent) {
    changes.push(`${name}: current ${edition.current} -> ${shouldBeCurrent}`);
    edition.current = shouldBeCurrent;
  }
}

// The live score card reads this file, so its slug has to follow the current
// edition or the card would poll for the previous game.
const snapshotPath = path.join(root, 'public/live-score.json');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
if (snapshot.slug !== target.slug) {
  changes.push(`public/live-score.json: ${snapshot.slug} -> ${target.slug}`);
  const played = target.finalScore;
  const next = {
    schemaVersion: 1,
    slug: target.slug,
    status: played ? 'final' : 'scheduled',
    statusLabel: played ? 'Final' : target.kickoff,
    homeScore: played ? played.home : null,
    awayScore: played ? played.away : null,
    homeRecord: target.home.record,
    awayRecord: target.away.record,
    updatedAt: new Date().toISOString(),
    source: DCTF_ATTRIBUTION.source,
    sourceUrl: 'https://www.texasfootball.com/scores/',
  };
  if (!dryRun) await writeFile(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
}

if (!dryRun) {
  for (const { name, edition } of editions) {
    await writeFile(path.join(root, 'content/editions', name), `${JSON.stringify(edition, null, 2)}\n`);
  }
}

console.log(`Current edition for ${today}: ${target.slug}`);
if (changes.length) console.log(`Changes:\n${changes.map((line) => `  - ${line}`).join('\n')}`);
else console.log('Already correct; nothing to change.');
if (problems.length) console.warn(`\nLeft alone:\n${problems.map((line) => `  - ${line}`).join('\n')}`);

if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${changes.length > 0 ? 'true' : 'false'}\n`);
}
