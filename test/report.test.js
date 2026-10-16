import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCidr, printableSections } from '../public/report.js';

test('explains the full queried CIDR block without treating it as a web path', () => {
  assert.deepEqual(describeCidr('41.249.120.0/21'), { start: '41.249.120.0', end: '41.249.127.255', count: '2048', version: 'IPv4' });
  assert.equal(describeCidr('2001:db8::/64').count, '18446744073709551616');
  assert.equal(describeCidr('8.8.8.8/32').count, '1');
  assert.equal(describeCidr('0.0.0.0/0').end, '255.255.255.255');
  for (const value of ['999.1.1.1/24', '8.8.8.8/33', '::1/129', 'https://example.com', undefined]) assert.equal(describeCidr(value), null);
});

test('print summary preserves unknowns, credit, version and record-date limitations', () => {
  const sections = printableSections({ queriedIp: '8.8.8.8', appVersion: '1.3.0', checkedAt: '2026-10-16T00:00:00Z', geolocationError: 'Provider unavailable', intelligence: { network: { status: 'available', indicators: { is_vpn: null, is_proxy: false } }, registration: { events: [{ action: 'last changed', date: '2020-01-01' }] } } });
  const text = sections.flatMap(section => section.lines).join('\n');
  assert.match(text, /vpn: Unknown/);
  assert.match(text, /proxy: No \(provider-reported\)/);
  assert.match(text, /Developed by Justice Floyd/);
  assert.match(text, /App version: 1.3.0/);
  assert.match(text, /not device activity/);
  assert.match(text, /Provider unavailable/);
  assert.match(text, /canonical: 8.8.8.8/);
});
