import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressDetails, normalizeNetwork, normalizeRegistration, collectIntelligence } from '../public/intelligence.js';
import { createServer } from '../server.js';

test('address facts distinguish common special-use ranges without device inference', () => {
  assert.equal(addressDetails('192.168.1.1').scope, 'Private network');
  assert.equal(addressDetails('100.64.0.1').scope, 'Shared carrier-grade NAT space');
  assert.equal(addressDetails('127.0.0.1').scope, 'Loopback');
  assert.equal(addressDetails('2001:db8::1').scope, 'Documentation');
  assert.equal(addressDetails('::1').scope, 'Loopback');
  assert.equal(addressDetails('8.8.8.8').decimal, '134744072');
  assert.equal(addressDetails('8.8.8.8').hexadecimal, '0x08080808');
  assert.equal(addressDetails('::1').decimal, '1');
  assert.equal(addressDetails('::1').binary.length, 128);
  assert.equal(addressDetails('2001:db8::1').expanded, '2001:0db8:0000:0000:0000:0000:0000:0001');
});

test('missing indicators are unknown, not negative, and public source data is retained', () => {
  const raw = { ip: '8.8.8.8', is_vpn: false, is_tor: true, is_proxy: 'false', asn: { asn: 15169, org: 'Example', route: '8.8.8.0/24' }, company: { type: 'hosting', abuser_score: '0.01 (Low)' } };
  const data = normalizeNetwork(raw);
  assert.equal(data.indicators.is_vpn, false);
  assert.equal(data.indicators.is_tor, true);
  assert.equal(data.indicators.is_proxy, null);
  assert.equal(data.indicators.is_mobile, null);
  assert.equal(data.network['Route prefix'], '8.8.8.0/24');
  assert.deepEqual(data.raw, raw);
});

test('parses registry ranges, events, and public abuse contacts without inventing device identity', () => {
  const data = normalizeRegistration({ objectClassName: 'ip network', handle: 'TEST', startAddress: '8.8.8.0', endAddress: '8.8.8.255', country: 'US', cidr0_cidrs: [{ v4prefix: '8.8.8.0', length: 24 }], events: [{ eventAction: 'registration', eventDate: '2000-01-01' }], entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['fn', {}, 'text', 'Network abuse desk'], ['email', {}, 'text', 'abuse@example.net']]] }] });
  assert.equal(data.fields['CIDR blocks'], '8.8.8.0/24');
  assert.equal(data.contacts[0].email, 'abuse@example.net');
  assert.equal(data.events[0].action, 'registration');
  assert.equal(data.fields['Registered country'], 'US');
});

test('provider failures preserve local address facts and independent registry results', async () => {
  const data = await collectIntelligence('8.8.8.8', async url => url.includes('ipapi.is') ? new Response('', { status: 429 }) : Response.json({ objectClassName: 'ip network', handle: 'EXAMPLE' }));
  assert.equal(data.network.status, 'unavailable');
  assert.match(data.network.message, /limit/);
  assert.equal(data.registration.status, 'available');
  assert.equal(data.address.canonical, '8.8.8.8');
});

test('collects observed BGP prefix and origin ASNs independently of registration', async () => {
  const data = await collectIntelligence('8.8.8.8', async url => url.includes('stat.ripe.net') ? Response.json({ data: { prefix: '8.8.8.0/24', asns: ['15169'] } }) : new Response('', { status: 503 }));
  assert.equal(data.routing.status, 'available');
  assert.equal(data.routing.prefix, '8.8.8.0/24');
  assert.deepEqual(data.routing.originAsns, ['15169']);
  assert.equal(data.registration.status, 'unavailable');
});

test('intelligence API validates input and returns independent availability states', async t => {
  let calls = 0;
  const server = createServer({ fetcher: async () => { calls++; throw new Error('sensitive transport details'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/intelligence?ip=bad')).status, 400);
  assert.equal(calls, 0);
  const response = await fetch(base + '/api/intelligence?ip=8.8.8.8:443');
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.address.canonical, '8.8.8.8');
  assert.equal(data.network.status, 'unavailable');
  assert.equal(data.registration.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(data), /sensitive/);
});
