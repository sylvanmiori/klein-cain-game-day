import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const docs = ['README.md', 'AGENTS.md', 'docs/PROJECT-GUIDE.md'];
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const problems = [];
const intentionallyRetired = new Set(['content/current-edition.json', 'content/archive/']);

for (const document of docs) {
  const text = await readFile(path.join(root, document), 'utf8');
  for (const match of text.matchAll(/`((?:app|cloudflare|components|config|content|docs|lib|public|scripts|\.github)\/[^`\s,)]+)/g)) {
    let reference = match[1].replace(/[.:;]+$/, '');
    if (reference.includes('*')) reference = reference.slice(0, reference.indexOf('*')).replace(/\/$/, '');
    if (intentionallyRetired.has(reference)) continue;
    // A #fragment is a doc-section anchor, not part of the filesystem path.
    const hashIndex = reference.indexOf('#');
    const filePath = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? '' : reference.slice(hashIndex + 1);
    try {
      await access(path.join(root, filePath));
    } catch {
      problems.push(`${document}: documented path does not exist: ${match[1]}`);
      continue;
    }
    if (anchor && filePath.endsWith('.md')) {
      // GitHub-style heading slug: downcase, drop punctuation, each space to a hyphen.
      const slugify = (heading) =>
        heading.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-');
      const fileText = await readFile(path.join(root, filePath), 'utf8');
      const slugs = new Set();
      for (const line of fileText.split('\n')) {
        const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)?.[2];
        if (heading) slugs.add(slugify(heading));
      }
      if (!slugs.has(anchor)) {
        problems.push(`${document}: documented anchor does not exist: ${match[1]}`);
      }
    }
  }
  for (const match of text.matchAll(/npm run ([a-z0-9:-]+)/g)) {
    if (!packageJson.scripts?.[match[1]]) problems.push(`${document}: documented npm script does not exist: ${match[1]}`);
  }
}

const templateText = await readFile(path.join(root, 'content/editions/TEMPLATE.md'), 'utf8');
const templateBlock = /```json\n([\s\S]*?)\n```/.exec(templateText)?.[1];
if (!templateBlock) {
  problems.push('content/editions/TEMPLATE.md: missing JSON example');
} else {
  try {
    const template = JSON.parse(templateBlock);
    const required = [
      'schemaVersion', 'slug', 'week', 'issue', 'state', 'date', 'dateLong', 'dateShort', 'kickoff',
      'venue', 'event', 'updated', 'home', 'away', 'pageTitle', 'metaTitle', 'metaDescription',
      'socialDescription', 'ogImage', 'prediction', 'massey', 'rankings', 'stats', 'gameStats',
      'finalScore', 'rating', 'weather', 'scheduledFacts', 'resultFacts', 'preview', 'final', 'sources',
      'footerNote', 'disclaimerEntities', 'current',
    ];
    for (const key of required) {
      if (!(key in template)) problems.push(`content/editions/TEMPLATE.md: JSON example is missing ${key}`);
    }
    if ([template.home?.logo, template.away?.logo].some((logo) => String(logo).includes('placeholder'))) {
      problems.push('content/editions/TEMPLATE.md: JSON example still uses a placeholder logo');
    }
  } catch (error) {
    problems.push(`content/editions/TEMPLATE.md: JSON example is invalid (${error.message})`);
  }
}

const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const logoSources = JSON.parse(await readFile(path.join(root, 'config/opponent-logos.json'), 'utf8'));
for (const game of schedule) {
  const matches = logoSources.filter((source) => source.name === game.opponent);
  if (matches.length !== 1) problems.push(`config/opponent-logos.json: ${game.opponent} must have exactly one source`);
  if (matches[0] && !String(matches[0].sourceUrl).startsWith('https://www.maxpreps.com/')) {
    problems.push(`config/opponent-logos.json: ${game.opponent} needs an exact MaxPreps https source`);
  }
}

const coaches = JSON.parse(await readFile(path.join(root, 'config/coaches.json'), 'utf8'));
if (!coaches.school?.name) problems.push('config/coaches.json: school head coach is missing');
if (!Array.isArray(coaches.school?.career) || coaches.school.career.length === 0) {
  problems.push('config/coaches.json: school head coach needs career stops');
}
for (const game of schedule) {
  const profile = coaches.opponents?.[game.opponent];
  if (!profile) {
    problems.push(`config/coaches.json: ${game.opponent} is missing a head coach profile`);
    continue;
  }
  if (!Array.isArray(profile.career) || profile.career.length === 0) {
    problems.push(`config/coaches.json: ${game.opponent} head coach needs career stops`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Checked ${docs.length} handoff documents, the edition template and opponent-logo coverage.`);
