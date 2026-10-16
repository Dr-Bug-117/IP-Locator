import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stopChild } from '../scripts/stop-child.js';

test('cleanup waits for the child process to close before deleting its working directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ip-locator-exit-'));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: directory, stdio: 'pipe' });
  let closed = false;
  child.once('close', () => { closed = true; });
  try {
    await once(child, 'spawn');
    await stopChild(child);
    assert.equal(closed, true);
    await stopChild(child); // Already stopped processes must not hang on retry.
  } finally {
    await stopChild(child);
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
