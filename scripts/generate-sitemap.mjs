// Generates public/sitemap.xml for search engines.
// Runs automatically before builds to ensure all pages and game editions
// are indexed with accurate canonical URLs, priorities, and change frequencies.

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const editionsDir = path.join(root, 'content/editions');
const publicDir = path.join(root, 'public');
const domain = 'https://kleincain.gameday.report';

const editionFiles = (await readdir(editionsDir))
  .filter((name) => name.endsWith('.json'))
  .sort();

const editions = await Promise.all(
  editionFiles.map(async (file) => {
    const fullPath = path.join(editionsDir, file);
    const content = JSON.parse(await readFile(fullPath, 'utf8'));
    const fileStat = await stat(fullPath);
    return {
      file,
      edition: content,
      mtime: fileStat.mtime.toISOString().split('T')[0],
    };
  })
);

// Find the latest final edition and the current edition
let latestFinalWeek = 0;
let currentWeek = 0;
for (const { edition } of editions) {
  if (edition.final && edition.week > latestFinalWeek) {
    latestFinalWeek = edition.week;
  }
  if (edition.current) {
    currentWeek = edition.week;
  }
}

const today = new Date().toISOString().split('T')[0];

const urls = [
  {
    loc: `${domain}/`,
    lastmod: today,
    changefreq: 'daily',
    priority: '1.0',
  },
  {
    loc: `${domain}/photos`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.8',
  },
];

for (const { edition, mtime } of editions) {
  const isHighPriority = edition.week === currentWeek || edition.week === latestFinalWeek;
  const isPlayed = Boolean(edition.final);
  
  urls.push({
    loc: `${domain}/games/week-${edition.week}`,
    lastmod: mtime || edition.date,
    changefreq: isHighPriority ? 'daily' : isPlayed ? 'weekly' : 'monthly',
    priority: isHighPriority ? '0.9' : isPlayed ? '0.7' : '0.6',
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

await writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');
console.log(`Generated sitemap with ${urls.length} URLs at public/sitemap.xml`);
