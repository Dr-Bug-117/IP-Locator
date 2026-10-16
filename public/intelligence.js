export function addressDetails(ip) {
  let canonical = ip;
  let scope = 'Public-address candidate (not a routing guarantee)';
  const ipv6 = ip.includes(':');
  let decimal, hexadecimal, binary, expanded;
  if (!ipv6) {
    const parts = ip.split('.').map(Number);
    const number = parts.reduce((value, part) => value * 256 + part, 0);
    decimal = String(number);
    hexadecimal = '0x' + number.toString(16).padStart(8, '0');
    binary = number.toString(2).padStart(32, '0');
    expanded = ip;
    const ranges = [
      [0x00000000, 8, 'Current-network / unspecified'], [0x0a000000, 8, 'Private network'],
      [0x64400000, 10, 'Shared carrier-grade NAT space'], [0x7f000000, 8, 'Loopback'],
      [0xa9fe0000, 16, 'Link-local'], [0xac100000, 12, 'Private network'], [0xc0a80000, 16, 'Private network'],
      [0xc0000200, 24, 'Documentation'], [0xc6336400, 24, 'Documentation'], [0xcb007100, 24, 'Documentation'],
      [0xc6120000, 15, 'Benchmark testing'], [0xe0000000, 4, 'Multicast'], [0xf0000000, 4, 'Reserved'],
    ];
    for (const [base, prefix, label] of ranges) if (Math.floor(number / 2 ** (32 - prefix)) === Math.floor(base / 2 ** (32 - prefix))) { scope = label; break; }
  } else {
    canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    if (canonical === '::') scope = 'Unspecified';
    else if (canonical === '::1') scope = 'Loopback';
    else if (/^f[cd]/i.test(canonical)) scope = 'Unique-local / private network';
    else if (/^fe[89ab]/i.test(canonical)) scope = 'Link-local';
    else if (/^ff/i.test(canonical)) scope = 'Multicast';
    else if (/^2001:db8:/i.test(canonical)) scope = 'Documentation';
    else if (/^::ffff:/i.test(canonical)) scope = 'IPv4-mapped IPv6';
    const [left, right = ''] = canonical.split('::');
    const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
    const groups = canonical.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
    expanded = groups.map(group => group.padStart(4, '0')).join(':');
    hexadecimal = '0x' + expanded.replace(/:/g, '');
    decimal = BigInt(hexadecimal).toString();
    binary = BigInt(hexadecimal).toString(2).padStart(128, '0');
  }
  const reverseQuery = ipv6 ? hexadecimal.slice(2).split('').reverse().join('.') + '.ip6.arpa' : ip.split('.').reverse().join('.') + '.in-addr.arpa';
  return { canonical, version: ipv6 ? 'IPv6' : 'IPv4', bits: ipv6 ? 128 : 32, scope, expanded, decimal, hexadecimal, binary, reverseQuery };
}

export function normalizeNetwork(data) {
  if (data.error || !data.ip) throw new Error('Invalid network response');
  const flag = key => typeof data[key] === 'boolean' ? data[key] : null;
  const scalar = value => ['string', 'number', 'boolean'].includes(typeof value) ? value : null;
  return {
    status: 'available', source: 'api.ipapi.is', raw: data,
    indicators: Object.fromEntries(['is_vpn', 'is_proxy', 'is_tor', 'is_datacenter', 'is_mobile', 'is_crawler', 'is_satellite', 'is_abuser', 'is_bogon'].map(key => [key, flag(key)])),
    network: Object.fromEntries([
      ['Company', data.company?.name], ['Company domain', data.company?.domain], ['Company category', data.company?.type],
      ['Company network', data.company?.network], ['ASN', data.asn?.asn], ['ASN organization', data.asn?.org],
      ['ASN domain', data.asn?.domain], ['ASN category', data.asn?.type], ['Route prefix', data.asn?.route],
      ['Registry', data.rir], ['Hosting provider', data.datacenter?.datacenter], ['VPN provider', data.vpn?.service],
      ['Provider abuse score (company)', data.company?.abuser_score], ['Provider abuse score (ASN)', data.asn?.abuser_score],
    ].map(([key, value]) => [key, scalar(value)])),
    abuse: Object.fromEntries(['name', 'address', 'email', 'phone', 'country', 'network'].map(key => [key, scalar(data.abuse?.[key])])),
  };
}

export function normalizeRegistration(data) {
  if (data.objectClassName !== 'ip network') throw new Error('Invalid registry response');
  const contacts = [];
  function walk(entities, depth = 0) {
    if (depth > 3 || !Array.isArray(entities)) return;
    for (const entity of entities.slice(0, 20)) {
      const roles = Array.isArray(entity.roles) ? entity.roles.filter(role => typeof role === 'string') : [];
      const fields = {};
      for (const field of (entity.vcardArray?.[1] || []).slice(0, 30)) {
        if (!Array.isArray(field)) continue;
        if (['fn', 'org', 'email', 'tel'].includes(field[0]) && typeof field[3] === 'string') fields[field[0]] = field[3];
      }
      if (contacts.length < 20 && (Object.keys(fields).length || entity.handle)) contacts.push({ roles, handle: entity.handle, name: fields.fn, organization: fields.org, email: fields.email, phone: fields.tel });
      walk(entity.entities, depth + 1);
    }
  }
  walk(data.entities);
  const cidrs = (data.cidr0_cidrs || []).slice(0, 20).map(item => `${item.v4prefix || item.v6prefix}/${item.length}`);
  return {
    status: 'available', source: 'RDAP registry (via rdap.org)', raw: data,
    fields: { Handle: data.handle, 'Network name': data.name, 'IP version': data.ipVersion, 'Start address': data.startAddress, 'End address': data.endAddress, 'Registered country': data.country, 'Allocation type': data.type, 'Parent handle': data.parentHandle, 'WHOIS server': data.port43, 'CIDR blocks': cidrs.join(', '), Status: (data.status || []).join(', ') },
    events: (data.events || []).slice(0, 20).map(item => ({ action: item.eventAction, date: item.eventDate })),
    contacts,
    notices: [...(data.notices || []), ...(data.remarks || [])].slice(0, 10).map(item => ({ title: item.title, text: (item.description || []).join(' ').slice(0, 2000) })),
  };
}

export async function collectIntelligence(ip, fetcher = fetch, signal) {
  const query = async (url, normalize, source) => {
    try {
      const response = await fetcher(url, { credentials: 'omit', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
      if (!response.ok) return { status: 'unavailable', source, message: response.status === 429 ? 'Provider request limit reached. Try again later.' : 'Provider could not be reached.' };
      return normalize(await response.json());
    } catch {
      return { status: 'unavailable', source, message: 'No data retrieved. The provider may be unavailable, blocked, or require a plan.' };
    }
  };
  const [network, registration, routing] = await Promise.all([
    query(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}`, normalizeNetwork, 'api.ipapi.is'),
    query(`https://rdap.org/ip/${encodeURIComponent(ip)}`, normalizeRegistration, 'RDAP registry (via rdap.org)'),
    query(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`, response => {
      const data = response.data;
      if (typeof data?.prefix !== 'string' || !Array.isArray(data.asns)) throw new Error('No routing data');
      return { status: 'available', source: 'RIPEstat / RIPE RIS', prefix: data.prefix, originAsns: data.asns.filter(asn => /^\d+$/.test(String(asn))).map(String), raw: response };
    }, 'RIPEstat / RIPE RIS'),
  ]);
  return { address: addressDetails(ip), network, registration, routing, checkedAt: new Date().toISOString() };
}

export async function lookupIntelligence(ip, { fetcher = fetch, protocol = location.protocol, signal } = {}) {
  if (['http:', 'https:'].includes(protocol)) {
    try {
      const response = await fetcher(`/api/intelligence?ip=${encodeURIComponent(ip)}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) return await response.json();
    } catch { if (signal?.aborted) return; }
  }
  if (signal?.aborted) return;
  return collectIntelligence(ip, fetcher, signal);
}
