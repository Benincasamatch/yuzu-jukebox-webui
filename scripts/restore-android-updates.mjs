import { mkdir, readdir, copyFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = resolve('releases/android');
const target = resolve('dist/app-updates');
let files;
try { files = await readdir(source); } catch (error) { if (error.code === 'ENOENT') process.exit(0); throw error; }
await mkdir(target, { recursive: true });
files.sort((a, b) => Number(a.endsWith('.json')) - Number(b.endsWith('.json')));
for (const file of files) {
  if (/^(latest\.json|latest\.apk|yuzu-jukebox-\d+\.\d+\.\d+\.apk)$/.test(file)) {
    const staging = resolve(target, `.${file}.tmp`);
    await copyFile(resolve(source, file), staging);
    await rename(staging, resolve(target, file));
  }
}
