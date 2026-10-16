import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupAddress, normalizeAddress } from '../public/lookup.js';

test('browser input normalization handles IP endpoints', () => {
  assert.equal(normalizeAddress('104.26.5.123:443'), '104.26.5.123');
  assert.equal(normalizeAddress('[2001:4860::8888]:443'), '2001:4860::8888');
  for (const input of ['bad', '8.8.8.8:65536', '999.2.3.4', 'a:b:c']) assert.throws(() => normalizeAddress(input));
});

test('standalone page looks up directly without a Node backend', async () => {
  const calls = [];
  const result = await lookupAddress('104.26.5.123:443', { protocol: 'about:', fetcher: async url => {
    calls.push(url);
    return Response.json({ ip: '104.26.5.123', latitude: 37.7, longitude: -122.4, country_name: 'United States', org: 'Cloudflare', asn: 'AS13335' });
  } });
  assert.deepEqual(calls, ['https://ipapi.co/104.26.5.123/json/']);
  assert.equal(result.isp, 'Cloudflare');
  assert.equal(result.asn, '13335');
});

test('static hosted page falls back when its origin serves HTML instead of an API', async () => {
  const calls = [];
  await lookupAddress('8.8.8.8', { protocol: 'https:', fetcher: async url => {
    calls.push(url);
    return url.startsWith('/') ? new Response('<html>Static host</html>', { headers: { 'content-type': 'text/html' } }) : Response.json({ ip: '8.8.8.8', latitude: 37, longitude: -122 });
  } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'https://ipapi.co/8.8.8.8/json/');
});

test('blocked browser network produces an actionable error', async () => {
  await assert.rejects(lookupAddress('8.8.8.8', { protocol: 'about:', fetcher: async () => { throw new TypeError('Failed to fetch'); } }), /viewer could not connect/);
});
