// Creates a starter edition file for any scheduled game that has none, so the
// season keeps producing pages without anyone opening an editor.
//
//   node scripts/build-editions.mjs            create missing editions
//   node scripts/build-editions.mjs --dry-run  report what would be created
//
// No language model is involved. Every field is derived from the schedule, the
// publication config, or the district standings. What this deliberately does
// not write is analysis: no players to watch, no keys, no narrative. Those stay
// empty until a person or a reviewed process fills them, and the page is honest
// about being thin rather than padded with invented copy.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchTeamPage, parseDistrictRecords } from './lib/sources.mjs';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

const publication = await readJson('config/publication.json');
const schedule = await readJson('config/season-2026.json');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const existing = new Set((await readdir(path.join(root, 'content/editions'))).filter((n) => n.endsWith('.json')));

/** Mascots come from the district standings, which name teams "<name> <mascot>". */
let mascots = new Map();
try {
  const records = parseDistrictRecords(await fetchTeamPage(publication.teamPageUrl));
  for (const team of records.keys()) mascots = mascots.set(team, team);
} catch (error) {
  console.warn(`Could not read the standings for mascots (${error.message}); new editions will omit them.`);
}

function mascotFor(name) {
  for (const listed of mascots.keys()) {
    if (listed === name) return '';
    if (listed.startsWith(`${name} `)) return listed.slice(name.length + 1).trim();
  }
  return '';
}

/** Only opponents whose artwork is checked in get a real logo. */
async function logoFor(name) {
  const candidate = `/${slugify(name)}-logo.png`;
  try {
    await readFile(path.join(root, 'public', candidate.slice(1)));
    return candidate;
  } catch {
    return '/team-placeholder.svg';
  }
}

const created = [];

for (const [index, game] of schedule.entries()) {
  const week = index + 1;
  const slug = `${game.date}-${slugify(game.opponent)}`;
  const file = `${slug}.json`;
  if (existing.has(file)) continue;

  const [year, month, day] = game.date.split('-');
  const dateLong = `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
  const dateShort = `${MONTHS[Number(month) - 1].slice(0, 3).toUpperCase()} ${Number(day)}, ${year}`;
  const school = {
    name: publication.schoolName,
    mascot: publication.schoolMascot,
    logo: publication.schoolLogo,
    record: '',
    rank: null,
  };
  const opponent = {
    name: game.opponent,
    mascot: mascotFor(game.opponent),
    logo: await logoFor(game.opponent),
    record: '',
    rank: null,
  };
  const home = game.home ? school : opponent;
  const away = game.home ? opponent : school;
  const pageTitle = `${year} Week ${week} Preview: ${away.name} at ${home.name}`;

  const edition = {
    schemaVersion: 2,
    slug,
    week,
    issue: String(week - 1).padStart(2, '0'),
    state: 'preview',
    date: game.date,
    dateLong,
    dateShort,
    kickoff: game.kickoff,
    venue: game.venue,
    event: game.event ?? '',
    updated: '',
    home,
    away,
    pageTitle,
    metaTitle: `Week ${week} Preview: ${away.name} at ${home.name} | ${publication.siteName}`,
    metaDescription: `Matchup facts, records and the published forecast for ${publication.schoolName}'s Week ${week} game against ${game.opponent} on ${dateLong}.`,
    socialDescription: `Records, ranking and forecast for ${away.name} at ${home.name}.`,
    ogImage: '',
    prediction: null,
    massey: null,
    rankings: null,
    stats: null,
    finalScore: null,
    rating: null,
    weather: null,
    scheduledFacts: [],
    resultFacts: [],
    preview: {
      playersHeading: 'Players to watch',
      playersNote: '',
      intro: {
        heading: 'The matchup',
        // Deliberately factual and free of analysis: it states what is known
        // and what is still to come, rather than pretending to a preview.
        body: `${away.name} plays at ${home.name} on ${dateLong} at ${game.kickoff}, at ${game.venue}. Records, the statewide ranking and the published forecast on this page update automatically as the season goes on. Player notes are added only when they can be checked against a named source.`,
        facts: [],
      },
      players: [],
      recruiting: null,
      keys: null,
      gameInfo: null,
    },
    final: null,
    sources: [],
    footerNote: 'Independent fan publication · Facts on this page refresh from public sources.',
    disclaimerEntities: [
      'Klein ISD',
      `${publication.schoolName} High School`,
      `${game.opponent} High School`,
      'MaxPreps',
      'Dave Campbell’s Texas Football',
    ],
    current: false,
  };

  created.push(`${file} (Week ${week} vs ${game.opponent}${opponent.mascot ? `, ${opponent.mascot}` : ''}${opponent.logo.includes('placeholder') ? ', placeholder logo' : ''})`);
  if (!dryRun) {
    await writeFile(path.join(root, 'content/editions', file), `${JSON.stringify(edition, null, 2)}\n`);
  }
}

if (created.length) console.log(`Created:\n${created.map((line) => `  - ${line}`).join('\n')}`);
else console.log('Every scheduled game already has an edition.');

if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${created.length > 0 ? 'true' : 'false'}\n`);
}
