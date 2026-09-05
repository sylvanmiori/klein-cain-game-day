// Scans the built HTML for cross-edition leakage.
// The schedule and the edition switcher name every opponent by design, so this
// checks only the fields that identify a page: title, meta tags, the H1 and the
// footer disclaimer.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const clientDir = path.join(root, 'dist/client');
const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const publication = JSON.parse(await readFile(path.join(root, 'config/publication.json'), 'utf8'));

const editionsDir = path.join(root, 'content/editions');
const editions = await Promise.all(
  (await readdir(editionsDir))
    .filter((name) => name.endsWith('.json'))
    .map(async (name) => JSON.parse(await readFile(path.join(editionsDir, name), 'utf8'))),
);

const pages = editions.map((edition) => ({
  edition,
  file: path.join('games', `week-${edition.week}.html`),
}));

const problems = [];

for (const { edition, file } of pages) {
  const full = path.join(clientDir, file);
  let html;
  try {
    html = await readFile(full, 'utf8');
  } catch {
    problems.push(`${file}: was not built`);
    continue;
  }

  // The identifying regions of the page. The disclaimer is kept separate: it
  // names Klein ISD, and "Klein" is also a schedule opponent.
  const identity = [
    ...(html.match(/<title>[\s\S]*?<\/title>/g) ?? []),
    ...(html.match(/<meta[^>]+>/g) ?? []).filter((tag) => /name="(description|twitter:)|property="og:/.test(tag)),
    ...(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? []),
  ].join('\n');
  const disclaimer = (html.match(/class="disclaimer"[\s\S]*?<\/p>/) ?? [''])[0];

  const opponent = edition.home.name === publication.schoolName ? edition.away.name : edition.home.name;

  for (const game of schedule) {
    if (game.opponent === opponent || game.date === edition.date) continue;
    // URLs are dropped first: on the GitHub Pages build every asset path
    // carries the repository name, which contains "klein". Then this page's own
    // two team names are removed, because several schedule opponents are
    // prefixes of others ("Klein" of "Klein Cain", "Magnolia" of "Magnolia
    // West").
    const text = identity
      .replace(/https?:\/\/[^"'\s]*/g, '')
      .replaceAll(publication.schoolName, '')
      .replaceAll(opponent, '');
    if (new RegExp(`\\b${game.opponent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      problems.push(`${file}: identity fields still name ${game.opponent}, but this edition is vs ${opponent}`);
    }
  }

  if (!html.includes(`<title>${edition.metaTitle}`)) {
    problems.push(`${file}: title does not match the edition's metaTitle`);
  }
  if (!html.includes(edition.pageTitle)) {
    problems.push(`${file}: the page heading does not match the edition's pageTitle`);
  }
  if (!identity.includes(opponent)) {
    problems.push(`${file}: identity fields never name this edition's opponent (${opponent})`);
  }
  if (disclaimer && !disclaimer.includes(opponent)) {
    problems.push(`${file}: the disclaimer does not name ${opponent}`);
  }
}

if (problems.length) {
  console.error(`Build check failed:\n${problems.map((line) => `  - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`Checked ${pages.length} built page(s) for stale opponents.`);
