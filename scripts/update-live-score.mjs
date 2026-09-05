import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const dateInCentral = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const gameDate = process.env.GAME_DATE || dateInCentral;
const game = schedule.find((item) => item.date === gameDate);
const output = process.env.SCORE_OUTPUT || path.join(root, 'public/live-score.json');

if (!game) {
  console.log(`No Klein Cain game scheduled for ${gameDate}.`);
  process.exit(0);
}

const current = JSON.parse(await readFile(path.join(root, 'public/live-score.json'), 'utf8'));
const manual = Boolean(process.env.HOME_SCORE?.trim()) && Boolean(process.env.AWAY_SCORE?.trim());
let statusLabel = process.env.GAME_STATUS || '';
let homeScore;
let awayScore;
let source = 'Dave Campbell’s Texas Football';
let sourceUrl = 'https://www.texasfootball.com/scores/';

if (manual) {
  homeScore = Number(process.env.HOME_SCORE);
  awayScore = Number(process.env.AWAY_SCORE);
  source = 'Manual correction';
  sourceUrl = 'https://github.com/sylvanmiori/klein-cain-game-day/actions';
} else {
  const [year, month, day] = gameDate.split('-');
  const response = await fetch('https://www.texasfootball.com/api/schools/scoresGetJson', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      gameDate: `${month}/${day}/${year}`,
      schTypeTagId: 1,
      classConfTagId: -1,
      statusId: -1,
    }),
  });
  if (!response.ok) throw new Error(`Dave Campbell’s score request failed (${response.status}).`);

  const outer = await response.json();
  const envelope = JSON.parse(outer.d);
  if (!envelope.success) throw new Error(envelope.msg || 'Dave Campbell’s score request failed.');
  const games = JSON.parse(envelope.data);
  const result = games.find((item) =>
    item.school?.toLowerCase() === 'klein cain' &&
    item.opponent?.toLowerCase().includes(game.opponent.toLowerCase())
  );
  if (!result) throw new Error(`No Dave Campbell’s score found for Klein Cain vs ${game.opponent}.`);

  statusLabel = result.status || 'Scheduled';
  const cainScore = Number(result.score);
  const opponentScore = Number(result.opponentScore);
  homeScore = game.home ? cainScore : opponentScore;
  awayScore = game.home ? opponentScore : cainScore;
}

const status = /final/i.test(statusLabel)
  ? 'final'
  : /quarter|qtr|q[1-4]|1st|2nd|3rd|4th|half|ot|delay|live/i.test(statusLabel)
    ? 'live'
    : 'scheduled';

function advanceRecord(record, won) {
  const match = record.match(/(\d+)\D+(\d+)/);
  if (!match) return record;
  return `${Number(match[1]) + (won ? 1 : 0)}–${Number(match[2]) + (won ? 0 : 1)}`;
}

let homeRecord = current.homeRecord;
let awayRecord = current.awayRecord;
if (status === 'final' && current.status !== 'final') {
  homeRecord = advanceRecord(homeRecord, homeScore > awayScore);
  awayRecord = advanceRecord(awayRecord, awayScore > homeScore);
}

const next = {
  schemaVersion: 1,
  slug: `${game.date}-${game.opponent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
  status,
  statusLabel: status === 'scheduled' ? game.kickoff : statusLabel,
  homeScore: status === 'scheduled' ? null : homeScore,
  awayScore: status === 'scheduled' ? null : awayScore,
  homeRecord,
  awayRecord,
  updatedAt: current.slug === `${game.date}-${game.opponent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}` && current.status === 'final' && status === 'final'
    ? current.updatedAt
    : new Date().toISOString(),
  source,
  sourceUrl,
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(next, null, 2)}\n`);
console.log(`${next.statusLabel}: Oak Ridge ${next.awayScore ?? '–'}, Klein Cain ${next.homeScore ?? '–'}.`);
