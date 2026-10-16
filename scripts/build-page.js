import { mkdir, readFile, writeFile } from 'node:fs/promises';
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
const [template, css, js, lookup, providers, intelligence] = await Promise.all([read('./index.template.html'), read('../public/style.css'), read('../public/app.js'), read('../public/lookup.js'), read('../public/providers.js'), read('../public/intelligence.js')]);
const script = `(() => {\n${intelligence.replace(/^export /gm, '')}\n${providers.replace(/^export /gm, '')}\n${lookup.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')}\n${js}\n})();`;
const html = template.replace('<link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script>', () => `<style>${css}</style>`).replace('</body>', () => `<script>${script}</script></body>`).replace('maxlength="45"', 'maxlength="53"');
await writeFile(new URL('../public/index.html', import.meta.url), html);
await mkdir(new URL('../downloads/', import.meta.url), { recursive: true });
await writeFile(new URL('../downloads/IP-Locator.html', import.meta.url), html);
console.log('Built web page and downloads/IP-Locator.html');
