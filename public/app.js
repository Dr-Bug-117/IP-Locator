const form = document.querySelector('#lookup-form');
const input = document.querySelector('#ip');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const details = document.querySelector('#details');
let busy = false;
status.textContent = '';

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
    document.querySelector('#location').textContent = [data.city, data.country].filter(Boolean).join(', ') || 'Location found';
    document.querySelector('#result-ip').textContent = `${data.ip} · ${data.type}`;
    details.replaceChildren();
    for (const [label, value] of [['Region', data.region], ['Country', data.country], ['Coordinates', `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`], ['Timezone', data.timezone], ['Internet provider', data.isp], ['Network', data.asn ? `AS${data.asn} · ${data.organization || ''}` : data.organization]]) {
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
