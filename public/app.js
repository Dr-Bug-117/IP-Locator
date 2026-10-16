const form = document.querySelector('#lookup-form');
const input = document.querySelector('#ip');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const details = document.querySelector('#details');
const mapProvider = document.querySelector('#map-provider');
let activeEstimates = [];
let busy = false;
status.textContent = '';

function showEstimate(data) {
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
  busy = true;
  submit.disabled = true;
  submit.textContent = 'Locating…';
  results.hidden = true;
  document.querySelector('#map').removeAttribute('src');
  document.querySelector('#empty').hidden = true;
  status.textContent = 'Looking up the address…';
  status.classList.remove('error');
  try {
    const data = await lookupAddress(input.value);
    const estimates = data.estimates || [{ ...data, provider: data.provider || 'Location provider', status: 'available' }];
    const comparison = data.comparison || compareEstimates(estimates);
    document.querySelector('#location').textContent = comparison.state === 'disagreement' ? 'Location estimates differ' : [data.city, data.country].filter(Boolean).join(', ') || 'Location estimates';
    document.querySelector('#result-ip').textContent = `${data.ip} · ${data.type}`;
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
    document.querySelector('#checked-at').textContent = data.checkedAt ? `Providers checked ${new Date(data.checkedAt).toLocaleString()}. This is the lookup time, not the age of their database records.` : '';
    results.hidden = false;
    status.textContent = '';
  } catch (error) {
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
