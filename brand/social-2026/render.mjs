import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(path.join(here, name));
const output = (name) => path.join(here, name);

async function raster(svgName, pngName, size) {
  await sharp(await read(svgName)).resize(size).png().toFile(output(pngName));
}

async function composite(svgName, pngName, width, height, position) {
  const background = await sharp(await read('stadium-background.png'))
    .resize(width, height, { fit: 'cover', position })
    .png().toBuffer();
  await sharp(background).composite([{ input: await read(svgName), top: 0, left: 0 }]).png().toFile(output(pngName));
}

await raster('logo-mark.svg', 'avatar-1024.png', 1024);
await raster('logo-mark.svg', 'x-avatar-400.png', 400);
await raster('logo-mark.svg', 'reddit-avatar-256.png', 256);
await raster('logo-mark-light.svg', 'avatar-light-1024.png', 1024);
await raster('wordmark.svg', 'wordmark-1600.png', 1600);
await composite('x-header-overlay.svg', 'x-header-1500x500.png', 1500, 500, 'centre');
await composite('reddit-banner-overlay.svg', 'reddit-banner-1080x128.png', 1080, 128, 'centre');
await composite('instagram-launch-overlay.svg', 'instagram-launch-1080x1350.png', 1080, 1350, 'south');
await composite('instagram-story-overlay.svg', 'instagram-story-1080x1920.png', 1080, 1920, 'south');

console.log('Rendered nine PNG brand assets.');
