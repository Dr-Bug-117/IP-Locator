import { collectEvidence } from './providers.js';
// Shared by the bundled browser page and Node tests. No dependency on a local API.
export function normalizeAddress(value) {
  let ip = value.trim();
  const endpoint = ip.match(/^(?:\[([^\]]+)\]|(\d{1,3}(?:\.\d{1,3}){3})):(\d{1,5})$/);
  if (endpoint) {
    if (Number(endpoint[3]) > 65535) throw new Error('Enter a port between 0 and 65535.');
    ip = endpoint[1] || endpoint[2];
  }
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(part => Number(part) <= 255);
  let ipv6 = false;
  if (ip.includes(':') && /^[a-fA-F0-9:.]+$/.test(ip)) {
    try { ipv6 = new URL(`http://[${ip}]/`).hostname.startsWith('['); } catch { /* Invalid IPv6. */ }
  }
  if (!ipv4 && !ipv6) throw new Error('Enter a valid IPv4 or IPv6 address, optionally followed by a port.');
  return ip;
}

export async function lookupAddress(value, { fetcher = fetch, protocol = location.protocol } = {}) {
  const ip = normalizeAddress(value);
  if (protocol === 'http:' || protocol === 'https:') {
    try {
      const response = await fetcher(`/api/lookup?ip=${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(12000) });
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        if (response.ok) return data;
        if (response.status === 400 || response.status === 422) throw Object.assign(new Error(data.error), { inputError: true });
      }
    } catch (error) {
      if (error.inputError) throw error;
      // Static hosts and HTML viewers have no same-origin lookup server.
    }
  }
  try {
    return await collectEvidence(ip, fetcher);
  } catch (error) {
    if (error.status === 502) throw new Error('This viewer could not connect to the location providers. Check your connection and allow ipwho.is, ipapi.co, and dns.google if prompted.');
    throw error;
  }
}
