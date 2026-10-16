import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

const html = await readFile('public/index.html', 'utf8');
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
});
const result = { ip: '104.26.5.123', type: 'IPv4', city: 'San Francisco', country: 'United States', latitude: 37.7, longitude: -122.4, isp: 'Cloudflare' };

async function checkPage(url) {
  const page = await browser.newPage();
  const violations = [];
  page.on('pageerror', error => violations.push(error.message));
  page.on('console', message => { if (/violates.*Content Security Policy/.test(message.text())) violations.push(message.text()); });
  await page.route('https://www.openstreetmap.org/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Test map</p>' }));
  await page.route('**/api/lookup?*', route => {
    assert.equal(new URL(route.request().url()).searchParams.get('ip'), '104.26.5.123');
    return route.fulfill({ json: result });
  });
  try {
    await page.goto(url);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(246, 247, 242)');
    assert.equal(await page.locator('#status').textContent(), '');
    await page.locator('#ip').fill('104.26.5.123:443');
    await page.locator('#submit').click();
    await page.locator('#results').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#location').textContent(), 'San Francisco, United States');
    assert.match(await page.locator('#details').textContent(), /Cloudflare/);
    assert.deepEqual(violations, []);
  } finally { await page.close(); }
}

try {
  for (const [name, newline] of [['LF', '\n'], ['Windows CRLF', '\r\n'], ['bare CR', '\r']]) {
    const server = createServer({ page: html.replace(/\r?\n/g, newline) });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    try {
      await checkPage(`http://127.0.0.1:${server.address().port}/`);
      console.log(`${name}: design loads, lookup button renders results, no CSP violations.`);
    } finally { await new Promise(resolveClose => server.close(resolveClose)); }
  }
  if (process.argv.includes('--exe')) {
    const cwd = await mkdtemp(join(tmpdir(), 'ip-locator-browser-'));
    const child = spawn(resolve('downloads/IP-Locator.exe'), ['--no-open'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    try {
      const url = await new Promise((resolveUrl, reject) => {
        const timer = setTimeout(() => reject(new Error('EXE startup timed out')), 15000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('exit', code => { clearTimeout(timer); reject(new Error(`EXE exited early (${code})`)); });
        child.stdout.on('data', data => {
          output += data;
          const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
          if (match) { clearTimeout(timer); resolveUrl(match[0]); }
        });
      });
      await checkPage(url);
      console.log('Windows EXE: design and lookup interaction verified in Chromium from an empty folder.');
    } finally { child.kill(); await rm(cwd, { recursive: true, force: true }); }
  }
} finally { await browser.close(); }
