import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('build', { recursive: true });
await mkdir('downloads', { recursive: true });
process.env.PKG_CACHE_PATH ||= resolve('build/pkg-cache');
const { exec } = await import('@yao-pkg/pkg');
const page = await readFile('public/index.html', 'utf8');
await build({
  entryPoints: ['scripts/portable-entry.js'], bundle: true, platform: 'node',
  format: 'cjs', target: 'node22', outfile: 'build/portable.cjs',
  define: { PORTABLE_PAGE: JSON.stringify(page), 'import.meta.url': JSON.stringify('file:///portable-assets-not-used') },
});
await exec(['build/portable.cjs', '--target', 'node22-win-x64', '--output', 'downloads/IP-Locator.exe', '--no-bytecode', '--public-packages', '*', '--public']);
const exe = await readFile('downloads/IP-Locator.exe');
await writeFile('downloads/IP-Locator.exe.sha256', `${createHash('sha256').update(exe).digest('hex')}  IP-Locator.exe\n`);
console.log('Built downloads/IP-Locator.exe (Windows x64) and checksum.');
