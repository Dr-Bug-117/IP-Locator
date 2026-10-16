import { spawn } from 'node:child_process';
import { createServer } from '../server.js';

const server = createServer({ page: PORTABLE_PAGE });
server.on('error', () => {
  console.error('IP Locator could not start. Close this window and try again.');
  process.exitCode = 1;
});
server.listen(0, '127.0.0.1', () => {
  const address = `http://127.0.0.1:${server.address().port}/`;
  console.log('\nIP LOCATOR\n');
  console.log('Your app is running at: ' + address);
  console.log('Keep this window open while using the app. Close it to quit.');
  console.log('No installation required. Internet access is needed for lookups and maps.\n');
  if (process.platform === 'win32' && !process.argv.includes('--no-open')) {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', address], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => console.log('Open the address above in your browser.'));
    child.unref();
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
