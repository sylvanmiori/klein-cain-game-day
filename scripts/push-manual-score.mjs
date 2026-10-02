#!/usr/bin/env node
// Push a manual score update to the live-data branch.
// The Cloudflare score ingest reads live-data/manual-<slug>.json as a fallback
// when the upstream (Dave Campbell's) feed fails, and picks it up on its next
// tick if its updatedAt is newer than the last good score.
//
// Usage:
//   node scripts/push-manual-score.mjs --slug 2026-10-01-klein-collins \
//     --status live --home 7 --away 0 --label "2nd Quarter"
//   node scripts/push-manual-score.mjs --slug 2026-10-01-klein-collins \
//     --status final --home 28 --away 21 --label "Final"
//
// Requires `gh` with a token that can push to the live-data branch.

import { execFileSync } from 'node:child_process';

const REPO = 'sylvanmiori/klein-cain-game-day';
const BRANCH = 'live-data';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

function api(method, path, data) {
  const args = ['api', '-X', method, `repos/${REPO}${path}`];
  const opts = { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 };
  const out = data === undefined
    ? execFileSync('gh', args, opts)
    : execFileSync('gh', [...args, '--input', '-'], { ...opts, input: JSON.stringify(data) });
  return out ? JSON.parse(out) : {};
}

const slug = arg('slug');
const status = arg('status');
const home = Number(arg('home'));
const away = Number(arg('away'));
const label = arg('label', status === 'final' ? 'Final' : 'Live');

if (!slug || !['live', 'final'].includes(status) || !Number.isInteger(home) || !Number.isInteger(away)) {
  console.error('Usage: push-manual-score.mjs --slug <slug> --status live|final --home <n> --away <n> [--label <text>]');
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
