import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from '../server.js';

const directory = await mkdtemp(join(tmpdir(), 'ip-locator-check-'));
const child = spawn(process.execPath, [resolve('build/portable.cjs'), '--no-open'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
let err = '';
child.stdout.on('data', data => { log += data; });
child.stderr.on('data', data => { err += data; });
let web;
try {
  const address = await new Promise((resolveAddress, reject) => {
    const timer = setTimeout(() => reject(new Error(`Portable app startup timed out: ${err}`)), 10000);
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Portable app exited (${code}): ${err}`)); });
    child.stdout.on('data', () => {
      const url = log.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
      if (url) { clearTimeout(timer); resolveAddress(url); }
    });
  });
  const response = await fetch(address);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<style>/);
  assert.match(html, /lookup-form/);
  assert.equal((await fetch(`${address}api/lookup?ip=invalid`)).status, 400);
  assert.equal(html, await readFile('public/index.html', 'utf8'));
  console.log('Portable bundle starts from an empty directory, serves the complete interface, and validates input.');

  web = createServer();
  await new Promise(resolveListen => web.listen(0, '127.0.0.1', resolveListen));
  const download = await fetch(`http://127.0.0.1:${web.address().port}/download/windows`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-disposition'), 'attachment; filename="IP-Locator.exe"');
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.deepEqual(bytes, await readFile('downloads/IP-Locator.exe'));
  assert.equal(bytes.readUInt16LE(bytes.readUInt32LE(60) + 4), 0x8664);
  console.log('Windows download endpoint returns the exact x64 executable with attachment headers.');
} finally {
  child.kill();
  if (web) await new Promise(resolveClose => web.close(resolveClose));
  await rm(directory, { recursive: true, force: true });
}
