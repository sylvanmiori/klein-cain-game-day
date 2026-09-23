import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'public');
const source = path.join(publicDir, 'brand', 'cain-helmet-avatar-source.png');
const sourceImage = await readFile(source);

async function icon(size, filename) {
  const output = await sharp(sourceImage).resize(size, size).png().toBuffer();
  await writeFile(path.join(publicDir, filename), output);
  return output;
}

function ico(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  for (const [index, { size, data }] of pngs.entries()) {
    const entry = 6 + index * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  }
  return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
}

const faviconSizes = [16, 32, 48, 96, 192];
const faviconPngs = new Map();
for (const size of faviconSizes) {
  faviconPngs.set(size, await icon(size, `favicon-${size}x${size}.png`));
}
await icon(512, 'favicon.png');
await icon(180, 'apple-touch-icon.png');
await icon(512, 'icon-512x512.png');
await writeFile(
  path.join(publicDir, 'favicon.ico'),
  ico([16, 32, 48].map((size) => ({ size, data: faviconPngs.get(size) }))),
);

// Modern-browser vector icon: the approved helmet master embedded in an SVG
// wrapper (there is no true vector source for the helmet). Google Search does
// not use SVG favicons; the PNG/ICO assets above remain the Google-facing set.
const svgIcon = await sharp(sourceImage).resize(128, 128).png().toBuffer();
await writeFile(
  path.join(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Klein Cain Gameday Report"><image href="data:image/png;base64,${svgIcon.toString('base64')}" x="0" y="0" width="128" height="128"/></svg>\n`,
);

async function backdrop(width, height) {
  return sharp(sourceImage)
    .resize(width, height, { fit: 'cover' })
    .blur(45)
    .modulate({ brightness: 0.44 })
    .png()
    .toBuffer();
}

async function fadedSubject(size, fadeWidth) {
  const subject = await sharp(sourceImage).resize(size, size).png().toBuffer();
  const mask = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fade"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="${fadeWidth / size}" stop-color="white" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#fade)"/></svg>`);
  return sharp(subject).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const heroWidth = 1920;
const heroHeight = 1080;
const hero = await sharp(await backdrop(heroWidth, heroHeight))
  .composite([{ input: await fadedSubject(heroHeight, 360), left: heroWidth - heroHeight, top: 0 }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();
await writeFile(path.join(publicDir, 'hero-next-game.jpg'), hero);
await writeFile(path.join(publicDir, 'hero-helmet.jpg'), hero);

const ogWidth = 1200;
const ogHeight = 630;
// Share card: the 16:9 helmet graphic with no text. (The "KLEIN CAIN / GAME
// DAY REPORT" word overlay was removed 2026-09-22 per editorial direction:
// link previews already carry the title, so words on the image read amateur.)
await sharp(await backdrop(ogWidth, ogHeight))
  .composite([
    { input: await fadedSubject(ogHeight, 235), left: ogWidth - ogHeight, top: 0 },
  ])
  .png()
  .toFile(path.join(publicDir, 'og.png'));

await mkdir(path.join(root, 'output', 'brand'), { recursive: true });
console.log('Built site icons, share card, and hero images from the approved helmet avatar.');
