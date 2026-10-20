import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('Create the macOS app icon on macOS.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'ayatrisya-desktop.png');
const outputDir = path.join(root, 'desktop', 'build');
const iconset = path.join(outputDir, 'ayatrisya.iconset');
const output = path.join(outputDir, 'ayatrisya.icns');
await rm(iconset, { recursive: true, force: true });
await mkdir(iconset, { recursive: true });
for (const size of [16, 32, 64, 128, 256, 512]) {
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', path.join(iconset, `icon_${size}x${size}.png`)], { stdio: 'inherit' });
  if (size < 512) {
    execFileSync('sips', ['-z', String(size * 2), String(size * 2), source, '--out', path.join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: 'inherit' });
  }
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', output], { stdio: 'inherit' });
await rm(iconset, { recursive: true, force: true });
console.log(`Created ${output}`);
