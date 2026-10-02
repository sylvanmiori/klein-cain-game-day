#!/usr/bin/env node
// Push a manual score update to the live-data branch.
// The Cloudflare score ingest treats live-data/manual-<slug>.json as an
// editor override: a fresh file wins over the upstream (Dave Campbell's) feed
// even when the feed is healthy, and is picked up on the next tick. Use it
// when the feed is wrong — e.g. DCTF marked the postponed Week 5 game "final"
// on 2026-10-01. Delete the file when the override is no longer needed;
// files older than 7 days are ignored as a safety net.
//
// Usage:
//   node scripts/push-manual-score.mjs --slug 2026-10-01-klein-collins \
//     --status live --home 7 --away 0 --label "2nd Quarter"
//   node scripts/push-manual-score.mjs --slug 2026-10-01-klein-collins \
//     --status final --home 28 --away 21 --label "Final"
//   node scripts/push-manual-score.mjs --slug 2026-10-01-klein-collins \
//     --status postponed --home 14 --away 7 --label "Postponed · Resumes Sat 10 AM"
//
// Requires the github skill's ghapi.py for authenticated GitHub API access.

import { execFileSync } from 'node:child_process';

const GHAPI = '/home/hatch/workspace/skills/github/bin/ghapi.py';
const REPO = 'sylvanmiori/klein-cain-game-day';
const BRANCH = 'live-data';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

function api(method, path, data) {
  const args = [method, `/repos/${REPO}${path}`];
  if (data !== undefined) args.push('--data', JSON.stringify(data));
  const out = execFileSync(GHAPI, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out);
}

const slug = arg('slug');
const status = arg('status');
const home = Number(arg('home'));
const away = Number(arg('away'));
const label = arg('label', status === 'final' ? 'Final' : status === 'postponed' ? 'Postponed' : 'Live');

if (!slug || !['live', 'final', 'postponed'].includes(status) || !Number.isInteger(home) || !Number.isInteger(away)) {
  console.error('Usage: push-manual-score.mjs --slug <slug> --status live|final|postponed --home <n> --away <n> [--label <text>]');
  process.exit(1);
}

const payload = {
  schemaVersion: 1,
  slug,
  status,
  statusLabel: label,
  homeScore: home,
  awayScore: away,
  homeRecord: '',
  awayRecord: '',
  updatedAt: new Date().toISOString(),
  source: 'Manual update',
  sourceUrl: 'https://kleincain.gameday.report/',
};

const ref = api('GET', `/git/refs/heads/${BRANCH}`);
const baseSha = ref.object.sha;
const baseCommit = api('GET', `/git/commits/${baseSha}`);
const blob = api('POST', '/git/blobs', {
  content: Buffer.from(JSON.stringify(payload, null, 2) + '\n').toString('base64'),
  encoding: 'base64',
});
const tree = api('POST', '/git/trees', {
  base_tree: baseCommit.tree.sha,
  tree: [{ path: `manual-${slug}.json`, mode: '100644', type: 'blob', sha: blob.sha }],
});
const commit = api('POST', '/git/commits', {
  message: `Manual score: ${slug} ${home}-${away} (${label})`,
  tree: tree.sha,
  parents: [baseSha],
});
api('PATCH', `/git/refs/heads/${BRANCH}`, { sha: commit.sha });
console.log(`Pushed manual score for ${slug}: home ${home}, away ${away} (${label}) @ ${commit.sha.slice(0, 8)}`);
