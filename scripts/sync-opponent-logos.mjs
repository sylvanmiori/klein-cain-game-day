import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const USER_AGENT = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const schedule = await readJson('config/season-2026.json');
const sources = await readJson('config/opponent-logos.json');
const scheduled = new Set(schedule.map((game) => game.opponent));
const configured = new Set(sources.map((team) => team.name));
const missing = [...scheduled].filter((name) => !configured.has(name));
if (missing.length) throw new Error(`No logo source configured for ${missing.join(', ')}.`);

let downloaded = 0;
for (const team of sources.filter(({ name }) => scheduled.has(name))) {
  const filename = `${slugify(team.name)}-logo.png`;
  const localPath = path.join(root, 'public', filename);
  if (existsSync(localPath)) continue;

  const page = await fetch(team.sourceUrl, { headers: { 'user-agent': USER_AGENT } });
  if (!page.ok) throw new Error(`${team.name} profile returned HTTP ${page.status}`);
  const html = await page.text();
  const source = /https:\/\/image\.maxpreps\.io\/school-mascot\/[^"<]+/.exec(html)?.[0]?.replaceAll('&amp;', '&');
  if (!source) throw new Error(`No school logo found for ${team.name}.`);
  const separator = source.includes('?') ? '&' : '?';
  const image = await fetch(`${source}${separator}width=512&height=512&format=png`, {
    headers: { 'user-agent': USER_AGENT },
  });
  if (!image.ok) throw new Error(`${team.name} logo returned HTTP ${image.status}`);
  const bytes = Buffer.from(await image.arrayBuffer());
  if (!bytes.subarray(1, 4).equals(Buffer.from('PNG'))) {
    throw new Error(`${team.name} logo was not returned as a PNG.`);
  }
  await writeFile(localPath, bytes);
  downloaded += 1;
}

let updated = 0;
const editionDir = path.join(root, 'content', 'editions');
for (const filename of (await readdir(editionDir)).filter((name) => name.endsWith('.json'))) {
  const file = path.join(editionDir, filename);
  const edition = JSON.parse(await readFile(file, 'utf8'));
  const opponent = [edition.home, edition.away].find((team) => scheduled.has(team?.name));
  if (!opponent) continue;
  const expected = `/${slugify(opponent.name)}-logo.png`;
  if (opponent.logo === expected) continue;
  opponent.logo = expected;
  await writeFile(file, `${JSON.stringify(edition, null, 2)}\n`);
  updated += 1;
}

console.log(`Downloaded ${downloaded} opponent logos; updated ${updated} editions.`);
