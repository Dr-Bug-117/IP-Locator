import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, parseAddress } from '../server.js';

test('accepts IP addresses with optional valid ports', () => {
  assert.equal(parseAddress('104.26.5.123:443'), '104.26.5.123');
  assert.equal(parseAddress('[2001:4860:4860::8888]:443'), '2001:4860:4860::8888');
  assert.equal(parseAddress('2001:4860::8888'), '2001:4860::8888');
  for (const value of ['8.8.8.8:99999', 'example.com:443', '999.1.1.1:443']) assert.equal(parseAddress(value), '');
});

async function serve(t, fetcher) {
  const server = createServer({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
}

test('serves application and restricts file access', async t => {
  const request = await serve(t);
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /lookup-form/);
  const html = await (await request('/')).text();
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
  assert.doesNotMatch(html, /src="\/app.js"|href="\/style.css"/);
  assert.match(response.headers.get('content-security-policy'), /sha256-/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await request('/server.js')).status, 404);
  assert.equal((await request('/style.css')).status, 200);
  assert.equal((await request('/app.js')).status, 200);
});

test('download endpoint serves the complete portable application as an attachment', async t => {
  const request = await serve(t);
  const response = await request('/download');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="IP-Locator.html"');
  const html = await response.text();
  assert.match(html, /<style>/);
  assert.match(html, /function lookupAddress/);
  assert.match(html, /https:\/\/ipapi.co/);
  assert.equal(html, await (await request('/')).text());
  assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(html));
});

test('rejects invalid addresses before contacting provider', async t => {
  const request = await serve(t, () => assert.fail('Provider must not be called'));
  for (const ip of ['', 'abc', '999.1.1.1', 'https://example.com']) {
    assert.equal((await request(`/api/lookup?ip=${encodeURIComponent(ip)}`)).status, 400);
  }
});

test('returns normalized geolocation for IPv4 and IPv6', async t => {
  const request = await serve(t, async url => {
    const ip = decodeURIComponent(url.split('/').at(-1));
    return Response.json({ success: true, ip, type: ip.includes(':') ? 'IPv6' : 'IPv4', city: 'Mountain View', country: 'United States', latitude: 37.4, longitude: -122.1, connection: { isp: 'Google', asn: 15169 }, timezone: { id: 'America/Los_Angeles' } });
  });
  for (const ip of ['8.8.8.8', '2001:4860:4860::8888']) {
    const response = await request(`/api/lookup?ip=${encodeURIComponent(ip)}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ip, ip);
    assert.equal(data.latitude, 37.4);
    assert.equal(data.isp, 'Google');
    assert.equal(data.timezone, 'America/Los_Angeles');
  }
});

test('handles reserved addresses and provider failures', async t => {
  const reserved = await serve(t, async () => Response.json({ success: false }));
  assert.equal((await reserved('/api/lookup?ip=127.0.0.1')).status, 422);
  const failure = await serve(t, async () => { throw new Error('sensitive internal detail'); });
  const response = await failure('/api/lookup?ip=8.8.8.8');
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /sensitive/);
  const malformed = await serve(t, async () => Response.json({ success: true, latitude: 'invalid' }));
  assert.equal((await malformed('/api/lookup?ip=8.8.8.8')).status, 502);
});

test('API returns provider comparisons and DNS evidence with partial outages', async t => {
  const request = await serve(t, async url => {
    if (url.includes('dns.google')) return Response.json({ Status: 0, Answer: [{ type: 12, data: 'gateway.example.net.' }] });
    if (url.includes('ipapi.co')) return new Response('', { status: 429 });
    return Response.json({ success: true, ip: '65.43.157.17', type: 'IPv4', city: 'Jackson', country: 'United States', latitude: 32.3, longitude: -90.2 });
  });
  const response = await request('/api/lookup?ip=65.43.157.17');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.comparison.state, 'limited');
  assert.equal(data.estimates[1].status, 'unavailable');
  assert.match(data.estimates[1].message, /Rate limit/);
  assert.deepEqual(data.reverseDns.hostnames, ['gateway.example.net']);
});
