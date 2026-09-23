// Generates public/sitemap.xml for search engines. A build by itself is not a
// content update, so lastmod comes from Git history and is omitted if unknown.

import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const editionsDir = path.join(root, 'content/editions');
const publicDir = path.join(root, 'public');
const domain = 'https://kleincain.gameday.report';

function lastmod(paths) {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

const editionFiles = (await readdir(editionsDir))
  .filter((name) => name.endsWith('.json'))
  .sort();

const editions = await Promise.all(
  editionFiles.map(async (file) => {
    const fullPath = path.join(editionsDir, file);
    const content = JSON.parse(await readFile(fullPath, 'utf8'));
    return {
      file,
      edition: content,
    };
  })
);

const urls = [
  {
    loc: `${domain}/`,
    lastmod: lastmod([
      'app/page.tsx', 'app/layout.tsx', 'components/team-page.tsx',
      'components/program-home-spotlight.tsx', 'components/seo-schema.tsx',
      'content/editions', 'content/season-data.json', 'content/galleries',
      'config/season-2026.json', 'public/hero-next-game.jpg',
    ]),
  },
  {
    loc: `${domain}/photos`,
    lastmod: lastmod([
      'app/photos/page.tsx', 'components/game-photos.tsx',
      'components/seo-schema.tsx', 'content/galleries', 'public/photos',
    ]),
  },
];

for (const { edition, file } of editions) {
  urls.push({
    loc: `${domain}/games/week-${edition.week}`,
    lastmod: lastmod([
      `content/editions/${file}`,
      `content/galleries/${edition.slug}.json`,
      'components/edition-page.tsx', 'components/seo-schema.tsx',
    ]),
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => [
    '  <url>',
    `    <loc>${u.loc}</loc>`,
    ...(u.lastmod ? [`    <lastmod>${u.lastmod}</lastmod>`] : []),
    '  </url>',
  ].join('\n'))
  .join('\n')}
</urlset>
`;

await writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');
console.log(`Generated sitemap with ${urls.length} URLs at public/sitemap.xml`);
