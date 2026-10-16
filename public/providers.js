export function normalizeEstimate(provider, data) {
  if ((provider === 'ipwho.is' && data.success !== true) || data.error) throw new Error('No public location returned');
  const { latitude, longitude } = data;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('No valid coordinates returned');
  return {
    provider, status: 'available', ip: data.ip, type: data.type || data.version,
    city: data.city || '', region: data.region || '', country: data.country_name || data.country || '',
    countryCode: data.country_code || data.country || '', latitude, longitude,
    timezone: typeof data.timezone === 'object' ? data.timezone?.id : data.timezone,
    isp: data.connection?.isp || data.org, organization: data.connection?.org || data.org,
    asn: String(data.connection?.asn || data.asn || '').replace(/^AS/i, ''),
  };
}

export function compareEstimates(estimates) {
  const available = estimates.filter(item => item.status === 'available');
  const named = available.filter(item => item.city && item.country);
  const key = item => [item.city, item.region, item.country].map(value => String(value || '').trim().toLowerCase()).join('|');
  const state = available.length < 2 ? 'limited' : named.length < 2 ? 'incomplete' : new Set(named.map(key)).size > 1 ? 'disagreement' : 'agreement';
  let spreadKm = 0;
  for (const a of available) for (const b of available) {
    const rad = value => value * Math.PI / 180;
    const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
    spreadKm = Math.max(spreadKm, 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
  }
  return { state, available: available.length, total: estimates.length, spreadKm: Math.round(spreadKm) };
}

export function reverseName(ip) {
  if (!ip.includes(':')) return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right = ''] = canonical.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const groups = canonical.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return groups.map(group => group.padStart(4, '0')).join('').split('').reverse().join('.') + '.ip6.arpa';
}

export async function collectEvidence(ip, fetcher = fetch) {
  const request = async url => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(6500), credentials: 'omit' });
    if (!response.ok) throw new Error(response.status === 429 ? 'Rate limit reached. Try again later.' : 'Provider unavailable.');
    return response.json();
  };
  const providers = [['ipwho.is', `https://ipwho.is/${encodeURIComponent(ip)}`], ['ipapi.co', `https://ipapi.co/${encodeURIComponent(ip)}/json/`]];
  const [estimates, reverseDns] = await Promise.all([
    Promise.all(providers.map(async ([provider, url]) => {
      try { return normalizeEstimate(provider, await request(url)); }
      catch (error) { return { provider, status: error.message === 'No public location returned' ? 'no_location' : 'unavailable', message: ['No public location returned', 'Rate limit reached. Try again later.'].includes(error.message) ? error.message : 'Could not retrieve this provider’s estimate.' }; }
    })),
    (async () => {
      try {
        const data = await request(`https://dns.google/resolve?name=${encodeURIComponent(reverseName(ip))}&type=PTR`);
        if (data.Status !== 0 && data.Status !== 3) return { status: 'unavailable', hostnames: [] };
        const hostnames = (data.Answer || []).filter(answer => answer.type === 12 && typeof answer.data === 'string').map(answer => answer.data.replace(/\.$/, ''));
        return { status: hostnames.length ? 'available' : 'not_found', hostnames };
      } catch { return { status: 'unavailable', hostnames: [] }; }
    })(),
  ]);
  const primary = estimates.find(item => item.status === 'available');
  if (!primary) {
    const error = new Error(estimates.some(item => item.status === 'no_location') ? 'No public geolocation is available for this address.' : 'Location providers are unavailable. Check your connection or try again shortly.');
    error.status = estimates.some(item => item.status === 'no_location') ? 422 : 502;
    throw error;
  }
  return { ...primary, estimates, comparison: compareEstimates(estimates), reverseDns, checkedAt: new Date().toISOString() };
}
