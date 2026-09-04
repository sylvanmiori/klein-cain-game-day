import { access, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const client = path.join(process.cwd(), 'dist', 'client');
const nestedRoot = path.join(client, 'klein-cain-game-day');
const nestedAssets = path.join(nestedRoot, '_next');
const publicAssets = path.join(client, '_next');

await access(nestedAssets);
await rm(publicAssets, { recursive: true, force: true });
await rename(nestedAssets, publicAssets);
await rm(nestedRoot, { recursive: true, force: true });

console.log('Prepared GitHub Pages asset paths.');
