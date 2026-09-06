import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rosterPath = path.join(root, 'content', 'roster-2026.json');
const photosDir = path.join(root, 'public', 'players');
const USER_AGENT = 'kleincain.gameday.report (contact: SylvanMiori@gmail.com)';

const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (name) => name
  .toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv)\.?$/i, '')
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const roster = JSON.parse(await readFile(rosterPath, 'utf8'));
const response = await fetch(roster.sourceUrl, { headers: { 'user-agent': USER_AGENT } });
if (!response.ok) throw new Error(`MaxPreps roster returned HTTP ${response.status}`);
const html = await response.text();
const photos = [...html.matchAll(/<img\s+src="([^"]+)"\s+alt="([^"]+) mugshot"/g)]
  .map((match) => ({ url: match[1].replaceAll('&amp;', '&'), name: match[2] }));
if (photos.length < 20) throw new Error(`Only found ${photos.length} roster photos; refusing a partial sync.`);

await mkdir(photosDir, { recursive: true });
let matched = 0;
let downloaded = 0;
for (const photo of photos) {
  const players = roster.players.filter((player) => normalize(player.name) === normalize(photo.name));
  if (!players.length) continue;
  const publicPath = `/players/${slug(photo.name)}.jpg`;
  const localPath = path.join(root, 'public', publicPath);
  for (const player of players) player.image = publicPath;
  matched += players.length;
  if (existsSync(localPath)) continue;
  const imageResponse = await fetch(photo.url.replace(/width=\d+/, 'width=512'), {
    headers: { 'user-agent': USER_AGENT },
  });
  if (!imageResponse.ok) throw new Error(`${photo.name} image returned HTTP ${imageResponse.status}`);
  await writeFile(localPath, Buffer.from(await imageResponse.arrayBuffer()));
  downloaded += 1;
}

await writeFile(rosterPath, `${JSON.stringify(roster, null, 2)}\n`);
console.log(`Matched ${matched} roster entries; downloaded ${downloaded} new portraits.`);
