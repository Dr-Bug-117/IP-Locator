import { addressDetails } from './intelligence.js';

export function describeCidr(value) {
  try {
    if (typeof value !== 'string' || !/^[0-9a-fA-F:.]+\/\d{1,3}$/.test(value)) return null;
    const [ip, length] = value.split('/');
    if (!ip.includes(':') && (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(part => Number(part) > 255))) return null;
    const address = addressDetails(ip);
    const prefix = Number(length);
    if (prefix > address.bits) return null;
    const hostBits = BigInt(address.bits - prefix);
    const start = (BigInt(address.decimal) >> hostBits) << hostBits;
    const count = 1n << hostBits;
    const format = number => address.bits === 32
      ? [24n, 16n, 8n, 0n].map(shift => String((number >> shift) & 255n)).join('.')
      : new URL(`http://[${number.toString(16).padStart(32, '0').match(/.{4}/g).join(':')}]/`).hostname.slice(1, -1);
    return { start: format(start), end: format(start + count - 1n), count: count.toString(), version: address.version };
  } catch { return null; }
}

export function printableSections(report) {
  const geo = report.geolocation;
  const intel = report.intelligence;
  const value = item => item === undefined || item === null || item === '' ? 'Unknown / not provided' : String(item);
  const pairs = fields => Object.entries(fields || {}).map(([key, item]) => `${key}: ${value(item)}`);
  return [
    { title: 'Lookup summary', lines: [`IP: ${report.queriedIp}`, `App version: ${report.appVersion || 'Unknown'}`, `Lookup started (UTC): ${report.checkedAt}`, 'Developed by Justice Floyd', report.limitations] },
    { title: 'Location estimates', lines: geo ? [...(geo.estimates || [geo]).map(item => `${item.provider || 'Provider'} · ${item.status || 'available'} · ${[item.city, item.region, item.country].filter(Boolean).join(', ') || item.message || 'No city details'}${item.latitude !== undefined ? ` · ${item.latitude}, ${item.longitude}` : ''}`), `Comparison: ${geo.comparison?.state || 'Not available'}`, `Sources checked (UTC): ${value(geo.checkedAt)}`, 'Provider agreement does not verify device location.'] : [report.geolocationError || 'Location data unavailable'] },
    { title: 'Address facts', lines: pairs(intel?.address || addressDetails(report.queriedIp)) },
    { title: 'Network classification', lines: [`${intel?.network?.source || 'Network source'} · ${intel?.network?.status || 'unavailable'}`, ...pairs(intel?.network?.network)] },
    { title: 'Provider-reported indicators', lines: [...Object.entries(intel?.network?.indicators || {}).map(([key, flag]) => `${key.replace(/^is_/, '').replace(/_/g, ' ')}: ${flag === true ? 'Yes (provider-reported)' : flag === false ? 'No (provider-reported)' : 'Unknown'}`), 'Missing checks are unknown, not negative findings. Scores and flags do not prove abuse.'] },
    { title: 'Observed Internet routing', lines: [`${intel?.routing?.source || 'RIPEstat'} · ${intel?.routing?.status || 'unavailable'}`, `Network range (CIDR — not a website): ${value(intel?.routing?.prefix)}`, `Routing network IDs (origin ASNs): ${intel?.routing?.originAsns?.map(asn => `AS${asn}`).join(', ') || 'Unknown'}`, 'Routes describe network announcements, not device identity or location.'] },
    { title: 'Public registration', lines: [`${intel?.registration?.source || 'RDAP'} · ${intel?.registration?.status || 'unavailable'}`, ...pairs(intel?.registration?.fields), ...(intel?.registration?.events || []).map(event => `${event.action}: ${event.date}`), 'Registry dates describe records, not device activity or geolocation freshness.'] },
    { title: 'Published registry contacts', lines: [(intel?.registration?.contacts || []).map(contact => [contact.roles?.join(', '), contact.name, contact.organization, contact.handle, contact.email, contact.phone].filter(Boolean).join(' · ')).join('\n') || 'No public contacts returned.', 'These are registry/network-operation contacts, not the user of the device.'] },
    { title: 'Published abuse-reporting contact', lines: pairs(intel?.network?.abuse) },
    { title: 'Reverse DNS', lines: [geo?.reverseDns?.hostnames?.join(', ') || 'No hostname available', 'Hostnames are operator-assigned clues, not verified device identities.'] },
    { title: 'Sources and limitations', lines: [`Extra sources checked (UTC): ${value(intel?.checkedAt)}`, 'Check time is not database freshness. Unavailable sources are not clean results.', 'Detailed AbuseIPDB, VirusTotal, and Talos report histories were not automatically retrieved.', 'No device OS, Windows username, accounts, files, MAC address, or exact street address is available from this lookup.'] },
  ];
}
