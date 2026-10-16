import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectEvidence, compareEstimates, reverseName } from '../public/providers.js';

const primary = { success: true, ip: '65.43.157.17', type: 'IPv4', city: 'Jackson', region: 'Mississippi', country: 'United States', latitude: 32.2988, longitude: -90.1848, connection: { isp: 'Example ISP', org: 'Example Network', asn: 1234 } };
const secondary = { ip: '65.43.157.17', version: 'IPv4', city: 'Tupelo', region: 'Mississippi', country_name: 'United States', latitude: 34.2576, longitude: -88.7034, org: 'Example Network', asn: 'AS1234' };

test('retains conflicting city evidence without inferring the actual device city', async () => {
  const result = await collectEvidence('65.43.157.17', async url => Response.json(url.includes('dns.google') ? { Status: 0, Answer: [{ type: 12, data: 'router.example.net.' }] } : url.includes('ipwho.is') ? primary : secondary));
  assert.equal(result.comparison.state, 'disagreement');
  assert.equal(result.comparison.available, 2);
  assert.ok(result.comparison.spreadKm > 200);
  assert.deepEqual(result.estimates.map(item => item.city), ['Jackson', 'Tupelo']);
  assert.deepEqual(result.reverseDns, { status: 'available', hostnames: ['router.example.net'] });
  assert.equal(result.isp, 'Example ISP');
  assert.ok(result.checkedAt);
});

test('provider and DNS outages preserve the remaining estimate', async () => {
  const result = await collectEvidence('65.43.157.17', async url => {
    if (url.includes('ipwho.is')) throw new Error('private details');
    return url.includes('dns.google') ? Response.json({ Status: 2 }) : Response.json(secondary);
  });
  assert.equal(result.city, 'Tupelo');
  assert.equal(result.comparison.state, 'limited');
  assert.equal(result.reverseDns.status, 'unavailable');
  assert.equal(result.estimates[0].status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(result), /private details/);
});

test('normalizes city casing and distinguishes missing city evidence', () => {
  const a = { ...primary, status: 'available' };
  assert.equal(compareEstimates([a, { ...a, city: ' jackson ' }]).state, 'agreement');
  assert.equal(compareEstimates([a, { ...a, city: '' }]).state, 'incomplete');
});

test('rejects bad coordinates and reports total outages', async () => {
  await assert.rejects(collectEvidence('8.8.8.8', async () => Response.json({ success: true, latitude: 91, longitude: 0 })), error => error.status === 502);
  await assert.rejects(collectEvidence('8.8.8.8', async () => new Response('', { status: 429 })), error => error.status === 502);
});

test('reverse lookup names support IPv4 and compressed IPv6', () => {
  assert.equal(reverseName('65.43.157.17'), '17.157.43.65.in-addr.arpa');
  assert.equal(reverseName('::1'), '1.' + '0.'.repeat(31) + 'ip6.arpa');
  assert.equal(reverseName('2001:4860:4860::8888').split('.').length, 34);
});
