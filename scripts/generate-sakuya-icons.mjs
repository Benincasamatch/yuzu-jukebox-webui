// Deterministic conversion of the user's existing SVG, no artwork generation.
// Usage: node scripts/generate-sakuya-icons.mjs /absolute/path/to/sakuya.svg
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = process.argv[2];
if (!source) throw new Error('Provide the existing Sakuya SVG path');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const densities = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
for (const [density, [legacySize, adaptiveSize]] of Object.entries(densities)) {
  const dir = resolve(root, `android/app/src/main/res/mipmap-${density}`);
  const legacy = resolve(dir, 'ic_launcher.png');
  execFileSync('magick', [source, '-resize', `${Math.round(legacySize * .9)}x${Math.round(legacySize * .9)}`, '-background', 'white', '-gravity', 'center', '-extent', `${legacySize}x${legacySize}`, '-depth', '8', legacy]);
  execFileSync('magick', [legacy, '(', '+clone', '-alpha', 'extract', '-fill', 'black', '-colorize', '100', '-fill', 'white', '-draw', `circle ${legacySize/2},${legacySize/2} ${legacySize/2},0`, ')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', resolve(dir, 'ic_launcher_round.png')]);
  // The complete character fits the adaptive icon's central 66/108 safe region.
  const foregroundSize = Math.round(adaptiveSize * 66 / 108);
  execFileSync('magick', [source, '-resize', `${foregroundSize}x${foregroundSize}`, '-background', 'none', '-gravity', 'center', '-extent', `${adaptiveSize}x${adaptiveSize}`, '-depth', '8', resolve(dir, 'ic_launcher_foreground.png')]);
}
execFileSync('magick', [source, '-resize', '128x128', '-depth', '8', resolve(root, 'public/sakuya-icon.png')]);
console.log('Sakuya launcher icons and favicon generated');
