import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';
import { stopChild } from './stop-child.js';

const html = await readFile('public/index.html', 'utf8');
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
});
const result = { ip: '104.26.5.123', type: 'IPv4', city: 'San Francisco', country: 'United States', latitude: 37.7, longitude: -122.4, isp: 'Cloudflare' };

async function checkPage(url) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedText = text; } } });
    window.print = () => { window.printRequested = true; };
  });
  let payload = result;
  let payloadStatus = 200;
  let intelligencePayload = {
    address: { canonical: '104.26.5.123', version: 'IPv4' }, checkedAt: new Date().toISOString(),
    network: { status: 'available', source: 'api.ipapi.is', indicators: { is_vpn: false, is_datacenter: true }, network: { 'Company category': 'hosting' }, abuse: { email: 'abuse@example.net' }, raw: { is_vpn: false } },
    registration: { status: 'available', source: 'RDAP', fields: { 'Network name': 'EXAMPLE-NET', 'Registered country': 'US' }, contacts: [{ roles: ['abuse'], name: '<img src=x onerror=alert(1)>', email: 'abuse@example.net' }], events: [{ action: 'registration', date: '2000-01-01' }], notices: [] },
    routing: { status: 'available', source: 'RIPEstat', prefix: '104.26.0.0/20', originAsns: ['13335'] },
  };
  const violations = [];
  page.on('pageerror', error => violations.push(error.message));
  page.on('console', message => { if (/violates.*Content Security Policy/.test(message.text())) violations.push(message.text()); });
  await page.route('https://www.openstreetmap.org/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Test map</p>' }));
  await page.route('**/api/lookup?*', route => {
    assert.equal(new URL(route.request().url()).searchParams.get('ip'), '104.26.5.123');
    return route.fulfill({ status: payloadStatus, json: payload });
  });
  await page.route('**/api/intelligence?*', route => route.fulfill({ json: intelligencePayload }));
  try {
    await page.goto(url);
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(246, 247, 242)');
    assert.equal(await page.locator('#status').textContent(), '');
    await page.locator('#ip').fill('104.26.5.123:443');
    await page.locator('#submit').click();
    await page.locator('#results').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#location').textContent(), 'San Francisco, United States');
    assert.match(await page.locator('#details').textContent(), /Cloudflare/);
    await page.locator('#export-report:not([disabled])').waitFor();
    assert.match(await page.locator('#network-facts').textContent(), /hosting/);
    assert.match(await page.locator('#network-indicators').textContent(), /Unknown/);
    assert.match(await page.locator('#registration-facts').textContent(), /EXAMPLE-NET/);
    assert.match(await page.locator('#routing-facts').textContent(), /AS13335/);
    assert.equal(await page.locator('#registration-contacts img').count(), 0);
    const downloaded = page.waitForEvent('download');
    await page.locator('#export-report').click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const report = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(report.queriedIp, '104.26.5.123');
    assert.equal(report.intelligence.network.indicators.is_vpn, false);
    assert.match(await page.locator('#app-version').textContent(), /^v\d+\.\d+\.\d+$/);
    assert.equal(report.appVersion, (await page.locator('#app-version').textContent()).slice(1));
    assert.match(await page.locator('#routing-facts').textContent(), /CIDR — not a website/);
    assert.match(await page.locator('#cidr-explanation').textContent(), /104.26.0.0 through 104.26.15.255/);
    const currentUrl = page.url();
    await page.getByRole('button', { name: 'Copy Network range (CIDR — not a website)', exact: true }).click();
    assert.equal(await page.evaluate(() => window.copiedText), '104.26.0.0/20');
    assert.equal(page.url(), currentUrl);
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Blocked'); }; });
    await page.getByRole('button', { name: 'Copy IP address', exact: true }).click();
    assert.equal(await page.locator('#copy-status textarea').inputValue(), '104.26.5.123');
    assert.equal(await page.locator('#record-links a').first().getAttribute('href'), 'https://rdap.org/ip/104.26.5.123');
    await page.locator('#print-report').click();
    assert.equal(await page.evaluate(() => window.printRequested), true);
    assert.match(await page.locator('#printable-report').textContent(), /Developed by Justice Floyd/);
    assert.match(await page.locator('#printable-report').textContent(), /not a website/);
    assert.equal(await page.locator('#printable-report img').count(), 0);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('main').isVisible(), false);
    assert.equal(await page.locator('#printable-report').isVisible(), true);
    const pdf = await page.pdf();
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.ok(pdf.length > 1000);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'screen' });
    const estimates = [
      { ...result, provider: 'ipwho.is', status: 'available', city: 'Jackson', region: 'Mississippi', latitude: 32.2988, longitude: -90.1848 },
      { ...result, provider: 'ipapi.co', status: 'available', city: 'Tupelo', region: 'Mississippi', latitude: 34.2576, longitude: -88.7034 },
    ];
    payload = { ...estimates[0], estimates, comparison: { state: 'disagreement', available: 2, total: 2, spreadKm: 258 }, reverseDns: { status: 'available', hostnames: ['router.example.net'] }, checkedAt: new Date().toISOString() };
    await page.locator('#submit').click();
    await page.locator('#location').filter({ hasText: 'Location estimates differ' }).waitFor();
    assert.match(await page.locator('#provider-cards').textContent(), /Jackson.*Tupelo/s);
    assert.match(await page.locator('#comparison-summary').textContent(), /actual device location is unresolved/);
    assert.match(await page.locator('#reverse-dns').textContent(), /router.example.net/);
    await page.locator('#map-provider').selectOption('ipapi.co');
    assert.match(await page.locator('#map-caption').textContent(), /Tupelo/);
    assert.match(await page.locator('#map').getAttribute('src'), /34.2576/);
    payload = { ...estimates[0], estimates: [estimates[0], { provider: 'ipapi.co', status: 'unavailable', message: 'Provider unavailable' }], comparison: { state: 'limited', available: 1, total: 2, spreadKm: 0 }, reverseDns: { status: 'not_found', hostnames: [] } };
    await page.locator('#submit').click();
    await page.locator('#comparison-summary').filter({ hasText: 'Only one provider' }).waitFor();
    assert.equal(await page.locator('#map-provider option').count(), 1);
    assert.match(await page.locator('#reverse-dns').textContent(), /No reverse-DNS hostname/);
    intelligencePayload = { checkedAt: new Date().toISOString(), network: { status: 'unavailable', source: 'api.ipapi.is' }, registration: { status: 'unavailable', source: 'RDAP' }, routing: { status: 'unavailable', source: 'RIPEstat' } };
    await page.locator('#submit').click();
    await page.locator('#export-report:not([disabled])').waitFor();
    assert.match(await page.locator('#network-source').textContent(), /unavailable/);
    assert.doesNotMatch(await page.locator('#network-indicators').textContent(), /No · provider-reported/);
    assert.equal(await page.locator('#results').isVisible(), true);
    payloadStatus = 422;
    payload = { error: 'No public geolocation is available for this address.' };
    await page.locator('#submit').click();
    await page.locator('#status').filter({ hasText: 'No public geolocation' }).waitFor();
    await page.locator('#export-report:not([disabled])').waitFor();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#intelligence').isVisible(), true);
    assert.match(await page.locator('#raw-evidence').textContent(), /"geolocationStatus": "unavailable"/);
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
    } finally {
      await stopChild(child);
      await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
} finally { await browser.close(); }
