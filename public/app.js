const form = document.querySelector('#lookup-form');
const input = document.querySelector('#ip');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const details = document.querySelector('#details');
const mapProvider = document.querySelector('#map-provider');
let activeEstimates = [];
let intelligenceController;
let lookupId = 0;
let activeReport;
const exportReport = document.querySelector('#export-report');
const printReport = document.querySelector('#print-report');
let busy = false;
status.textContent = '';

function copyButton(value, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', `Copy ${label}`);
  button.addEventListener('click', async () => {
    const message = document.querySelector('#copy-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(value));
      message.textContent = `${label} copied.`;
    } catch {
      const field = document.createElement('textarea');
      field.value = String(value);
      field.setAttribute('aria-label', 'Select and copy this value');
      message.replaceChildren(document.createTextNode('Clipboard access is blocked. Select this value and copy it: '), field);
      field.focus();
      field.select();
    }
  });
  return button;
}

function recordLink(container, label, url) {
  const link = document.createElement('a');
  link.href = url;
  link.textContent = `${label} ↗`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  container.append(link);
}

function renderFacts(selector, fields) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  for (const [name, value] of Object.entries(fields)) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = name;
    const present = value !== null && value !== undefined && value !== '';
    const text = document.createElement('span');
    text.textContent = present ? String(value) : 'Unknown / not provided';
    detail.append(text);
    if (present) detail.append(copyButton(value, name));
    item.append(term, detail);
    list.append(item);
  }
}
function refreshRawEvidence() {
  if (!activeReport) return;
  document.querySelector('#raw-evidence').textContent = JSON.stringify(activeReport, null, 2);
  exportReport.disabled = activeReport.geolocationStatus === 'pending' || activeReport.intelligenceStatus === 'pending';
  printReport.disabled = exportReport.disabled;
}
async function showIntelligence(ip, id) {
  intelligenceController = new AbortController();
  const signal = intelligenceController.signal;
  document.querySelector('#intelligence').hidden = false;
  document.querySelector('#intelligence-status').textContent = 'Retrieving network classification and public registration…';
  for (const selector of ['#address-facts', '#network-facts', '#routing-facts', '#registration-facts', '#abuse-contact', '#network-indicators', '#registration-events', '#registration-contacts', '#registration-notices', '#reputation-links', '#raw-evidence']) document.querySelector(selector).replaceChildren();
  document.querySelector('#network-source').textContent = 'Waiting for provider…';
  document.querySelector('#registration-source').textContent = 'Waiting for registry…';
  document.querySelector('#routing-source').textContent = 'Waiting for routing data…';
  document.querySelector('#cidr-explanation').textContent = '';
  document.querySelector('#copy-status').textContent = '';
  const records = document.querySelector('#record-links');
  records.replaceChildren();
  recordLink(records, 'Public registry record (RDAP)', `https://rdap.org/ip/${encodeURIComponent(ip)}`);
  recordLink(records, 'RIPEstat routing record', `https://stat.ripe.net/${encodeURIComponent(ip)}`);
  const address = addressDetails(ip);
  renderFacts('#address-facts', { 'Canonical address': address.canonical, Version: address.version, 'Address length (bits)': address.bits, 'Locally recognized scope': address.scope, 'Expanded address': address.expanded, Decimal: address.decimal, Hexadecimal: address.hexadecimal, Binary: address.binary, 'Reverse-DNS query name': address.reverseQuery });
  const links = document.querySelector('#reputation-links');
  for (const [name, url] of [['AbuseIPDB', `https://www.abuseipdb.com/check/${encodeURIComponent(ip)}`], ['VirusTotal', `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(ip)}`], ['Cisco Talos', `https://talosintelligence.com/reputation_center/lookup?search=${encodeURIComponent(ip)}`]]) {
    const link = document.createElement('a');
    link.textContent = `${name} ↗`;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.append(link);
  }
  try {
    const data = await lookupIntelligence(ip, { signal });
    if (id !== lookupId || signal.aborted || !data) return;
    activeReport.intelligence = data;
    activeReport.intelligenceStatus = 'complete';
    const network = data.network || { status: 'unavailable' };
    const registration = data.registration || { status: 'unavailable' };
    document.querySelector('#network-source').textContent = `${network.source || 'Network provider'} · ${network.status}${network.message ? ' · ' + network.message : ''}`;
    renderFacts('#network-facts', network.network || { Classification: 'Unavailable' });
    const routing = data.routing || { status: 'unavailable' };
    document.querySelector('#routing-source').textContent = `${routing.source || 'RIPEstat'} · ${routing.status}${routing.message ? ' · ' + routing.message : ''}`;
    renderFacts('#routing-facts', { 'Network range (CIDR — not a website)': routing.prefix, 'Routing network IDs (origin ASNs)': routing.originAsns?.map(asn => `AS${asn}`).join(', ') });
    const range = describeCidr(routing.prefix);
    document.querySelector('#cidr-explanation').textContent = range ? `This block contains ${BigInt(range.count).toLocaleString()} addresses: ${range.start} through ${range.end}. These are address values, not links to websites.` : 'A CIDR range describes a block of addresses, not a website.';
    for (const asn of routing.originAsns || []) if (/^\d+$/.test(String(asn))) recordLink(records, `Routing record for AS${asn}`, `https://stat.ripe.net/AS${asn}`);
    const labels = { is_vpn: 'VPN', is_proxy: 'Proxy', is_tor: 'Tor exit', is_datacenter: 'Datacenter / hosting', is_mobile: 'Mobile network', is_crawler: 'Crawler', is_satellite: 'Satellite network', is_abuser: 'Provider abuse indicator', is_bogon: 'Bogon / special-use' };
    for (const [key, label] of Object.entries(labels)) {
      const item = document.createElement('div');
      const name = document.createElement('span');
      const value = document.createElement('strong');
      const flag = network.indicators?.[key];
      name.textContent = label;
      value.textContent = flag === true ? 'Yes · provider-reported' : flag === false ? 'No · provider-reported' : 'Unknown';
      item.append(name, value);
      document.querySelector('#network-indicators').append(item);
    }
    document.querySelector('#registration-source').textContent = `${registration.source || 'RDAP registry'} · ${registration.status}${registration.message ? ' · ' + registration.message : ''}. Registered country is an allocation record, not device location.`;
    renderFacts('#registration-facts', registration.fields || { Registration: 'Unavailable' });
    renderFacts('#abuse-contact', network.abuse || { Contact: 'Not provided' });
    for (const event of registration.events || []) {
      const line = document.createElement('p');
      line.textContent = `${event.action}: ${event.date}`;
      line.append(document.createTextNode(' · Registry-record date, not device activity or location freshness.'));
      document.querySelector('#registration-events').append(line);
    }
    const contacts = document.querySelector('#registration-contacts');
    for (const contact of registration.contacts || []) {
      const line = document.createElement('p');
      line.textContent = [contact.roles?.join(', '), contact.name, contact.organization, contact.handle, contact.email, contact.phone].filter(Boolean).join(' · ');
      contacts.append(line);
    }
    if (!contacts.childElementCount) contacts.textContent = 'No public contacts returned.';
    for (const notice of registration.notices || []) {
      const line = document.createElement('p');
      line.textContent = [notice.title, notice.text].filter(Boolean).join(': ');
      document.querySelector('#registration-notices').append(line);
    }
    document.querySelector('#intelligence-status').textContent = `Sources checked ${new Date(data.checkedAt).toLocaleString()}. Unavailable services are not negative findings.`;
  } catch {
    if (id !== lookupId || signal.aborted) return;
    document.querySelector('#intelligence-status').textContent = 'Extra detail services are unavailable. Address facts and any location results remain available.';
  } finally {
    if (id === lookupId && !signal.aborted) {
      if (activeReport.intelligenceStatus === 'pending') activeReport.intelligenceStatus = 'unavailable';
      refreshRawEvidence();
    }
  }
}
exportReport.addEventListener('click', () => {
  if (!activeReport) return;
  const blob = new Blob([JSON.stringify(activeReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ip-locator-${activeReport.queriedIp.replace(/:/g, '_')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
printReport.addEventListener('click', () => {
  if (!activeReport || printReport.disabled) return;
  const report = document.querySelector('#printable-report');
  report.replaceChildren();
  const heading = document.createElement('h1');
  heading.textContent = 'IP Locator · Public network report';
  report.append(heading);
  for (const section of printableSections(activeReport)) {
    const block = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = section.title;
    block.append(title);
    for (const line of section.lines) {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      block.append(paragraph);
    }
    report.append(block);
  }
  document.body.classList.add('printing-report');
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'));

function showEstimate(data) {
  renderFacts('#context-facts', data.context || { 'Additional fields': 'Not provided; inspect raw responses below' });
  details.replaceChildren();
  for (const [label, value] of [['Estimated region', data.region], ['Estimated country', data.country], ['Estimated coordinates', `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`], ['Timezone', data.timezone], ['Network operator / ISP', data.isp], ['Network owner / ASN', data.asn ? `AS${data.asn} · ${data.organization || ''}` : data.organization]]) {
    const item = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value || 'Unavailable';
    item.append(dt, dd);
    details.append(item);
  }
  const lat = data.latitude, lon = data.longitude;
  const bbox = [Math.max(-180, lon - 0.12), Math.max(-90, lat - 0.08), Math.min(180, lon + 0.12), Math.min(90, lat + 0.08)].join(',');
  document.querySelector('#map').src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
  document.querySelector('#map-link').href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=11/${lat}/${lon}`;
  document.querySelector('#map-caption').textContent = `${data.provider || 'Provider'} estimate: ${[data.city, data.region, data.country].filter(Boolean).join(', ')}. This marker is not an exact device location.`;
}
mapProvider.addEventListener('change', () => {
  const estimate = activeEstimates.find(item => item.provider === mapProvider.value);
  if (estimate) showEstimate(estimate);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  intelligenceController?.abort();
  const id = ++lookupId;
  activeReport = null;
  document.querySelector('#intelligence').hidden = true;
  exportReport.disabled = true;
  printReport.disabled = true;
  document.querySelector('#printable-report').replaceChildren();
  busy = true;
  submit.disabled = true;
  submit.textContent = 'Locating…';
  results.hidden = true;
  document.querySelector('#map').removeAttribute('src');
  document.querySelector('#empty').hidden = true;
  status.textContent = 'Looking up the address…';
  status.classList.remove('error');
  try {
    const ip = normalizeAddress(input.value);
    activeReport = { queriedIp: ip, appVersion: APP_VERSION, checkedAt: new Date().toISOString(), geolocationStatus: 'pending', intelligenceStatus: 'pending', geolocation: null, intelligence: null, limitations: 'Public network data cannot identify a device, account, or exact physical location. Unknown flags are not negative findings.' };
    void showIntelligence(ip, id);
    const data = await lookupAddress(ip);
    activeReport.geolocation = data;
    activeReport.geolocationStatus = 'complete';
    refreshRawEvidence();
    const estimates = data.estimates || [{ ...data, provider: data.provider || 'Location provider', status: 'available' }];
    const comparison = data.comparison || compareEstimates(estimates);
    document.querySelector('#location').textContent = comparison.state === 'disagreement' ? 'Location estimates differ' : [data.city, data.country].filter(Boolean).join(', ') || 'Location estimates';
    document.querySelector('#result-ip').textContent = `${data.ip} · ${data.type}`;
    document.querySelector('#result-ip').append(copyButton(ip, 'IP address'));
    const summary = document.querySelector('#comparison-summary');
    const summaries = { disagreement: 'Providers disagree on the city or region. The actual device location is unresolved.', agreement: 'Both providers report the same city and region. This does not verify the device’s location.', limited: 'Only one provider returned an estimate. Cross-checking is unavailable.', incomplete: 'Providers returned incomplete city details. City agreement cannot be determined.' };
    summary.textContent = summaries[comparison.state];
    if (comparison.available > 1) summary.textContent += ` Estimate markers are about ${comparison.spreadKm} km apart. This is not an accuracy radius.`;
    summary.dataset.state = comparison.state;
    const cards = document.querySelector('#provider-cards');
    cards.replaceChildren();
    mapProvider.replaceChildren();
    activeEstimates = estimates.filter(item => item.status === 'available');
    for (const estimate of estimates) {
      const card = document.createElement('article');
      card.className = 'provider-card';
      const heading = document.createElement('h3');
      const location = document.createElement('p');
      const note = document.createElement('p');
      heading.textContent = estimate.provider;
      location.textContent = estimate.status === 'available' ? [estimate.city || 'City unavailable', estimate.region, estimate.country].filter(Boolean).join(', ') : 'Estimate unavailable';
      note.textContent = estimate.status === 'available' ? `${estimate.latitude.toFixed(4)}, ${estimate.longitude.toFixed(4)} · approximate` : estimate.message;
      card.append(heading, location, note);
      cards.append(card);
      if (estimate.status === 'available') {
        const option = document.createElement('option');
        option.value = estimate.provider;
        option.textContent = `${estimate.provider} · ${estimate.city || 'City unavailable'}`;
        mapProvider.append(option);
      }
    }
    showEstimate(activeEstimates[0]);
    const dns = data.reverseDns;
    document.querySelector('#reverse-dns').textContent = dns?.status === 'available' ? dns.hostnames.join(' · ') : dns?.status === 'not_found' ? 'No reverse-DNS hostname was returned.' : 'Reverse DNS is unavailable. The location estimates above are still usable.';
    if (dns?.status === 'available') document.querySelector('#reverse-dns').append(copyButton(dns.hostnames.join('\n'), 'reverse-DNS hostnames'));
    document.querySelector('#checked-at').textContent = data.checkedAt ? `Providers checked ${new Date(data.checkedAt).toLocaleString()}. This is the lookup time, not the age of their database records.` : '';
    results.hidden = false;
    status.textContent = '';
  } catch (error) {
    if (activeReport) {
      activeReport.geolocationStatus = 'unavailable';
      activeReport.geolocationError = error.message;
      refreshRawEvidence();
    }
    status.textContent = error.name === 'TimeoutError' ? 'The lookup timed out. Please try again.' : error instanceof TypeError ? 'Unable to reach the lookup server. Open the app through its running Node web server and try again.' : error.message;
    status.classList.add('error');
    document.querySelector('#empty').hidden = false;
  } finally {
    busy = false;
    submit.disabled = false;
    submit.textContent = 'Locate IP ↗';
  }
});
document.querySelectorAll('[data-ip]').forEach(button => button.addEventListener('click', () => {
  if (busy) return;
  input.value = button.dataset.ip;
  form.requestSubmit();
}));
