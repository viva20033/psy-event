/**
 * Generates PWA icons from public/icons/source.png
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'public/icons/source.png');
const outDir = path.join(root, 'public/icons');

const BG = '#f5f0e8'; // cream background from icon

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
];

async function resizeSquare(name, size) {
  await sharp(src)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(path.join(outDir, name));
  console.log('✓', name);
}

/** Maskable: icon on 512 canvas with ~10% padding (Android safe zone) */
async function maskable() {
  const canvas = 512;
  const inner = Math.round(canvas * 0.8);
  const padded = await sharp(src)
    .resize(inner, inner, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: padded, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, 'icon-512-maskable.png'));
  console.log('✓ icon-512-maskable.png');
}

for (const { name, size } of sizes) {
  await resizeSquare(name, size);
}
await maskable();
console.log('Done.');
