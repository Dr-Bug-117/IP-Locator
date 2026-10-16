# IP Locator

Version 1.3 adds copy buttons, explicit CIDR/ASN labels with range bounds and address counts, official registry/routing links, and an installed-version footer. Print / Save PDF opens a formatted text summary in the browser's print dialog; choose Save as PDF where supported. JSON and print summaries include the app version and source availability. Clipboard failures provide selectable text rather than navigating to an IP. Registry dates are not device activity or geolocation freshness timestamps. The build reads the version from package.json so the website, standalone HTML, and Windows package use the same version.

A responsive web application for looking up the approximate geographic location of public IPv4 and IPv6 addresses. Displays city, country, region, coordinates, timezone, ISP, ASN, and an OpenStreetMap map.

Version 1.1 compares ipwho.is and ipapi.co estimates side by side, highlights city/region disagreements, and lets users select each provider's map marker. Network ownership is separate from physical location. Reverse-DNS hostnames from Google Public DNS are shown as clues only. Provider agreement is not proof of device location; the separation between markers is not an accuracy radius. A provider or DNS outage does not discard another provider's successful estimate. Lookup timestamps are not database freshness timestamps.

Version 1.2 adds independent public intelligence: exact address representations, common scope classifications, ipapi.is network/company and provider-reported indicators, RDAP registration/contacts, and observed BGP prefix/origin ASNs from RIPEstat. Missing flags remain Unknown. Scores can describe an entire company/ASN and are labeled accordingly. Extra country/location context and all successful source responses are available in an expandable JSON view. Download JSON report exports the current lookup, source availability, raw responses, and limitations. External reputation links are research links; their detailed histories have not been automatically checked.

Extra-detail HTTPS destinations are `api.ipapi.is`, `rdap.org` and its registry redirects (`rdap.arin.net`, `rdap.db.ripe.net`, `rdap.apnic.net`, `rdap.lacnic.net`, `rdap.afrinic.net`), and `stat.ripe.net`. `/api/intelligence?ip=8.8.8.8` returns independent source states and local address facts even if all extra providers fail. Each external request has an 8-second timeout. The web page loads this endpoint alongside geolocation and discards stale extra-detail responses when the IP changes. The standalone HTML uses direct HTTPS fallback when no backend is available; CORS and provider quotas still apply.

No API keys are embedded or required for the public integrations. Providers can change free access, limits, or commercial terms; verify terms and obtain appropriate plans before large-scale distribution. The development cloud blocked live access to the extra providers at implementation time; schema, outage, UI, and export tests use controlled responses. No device fingerprinting, port scans, account access, or target-device queries are performed.

## Downloadable application

Run `npm run build` to generate `downloads/IP-Locator.html`. Upload that single file to your file storage or database-backed download route. Users download and open it in their desktop browser; no server installation is needed on their computer. Internet access is required for lookups and maps. See `downloads/UPLOAD-GUIDE.md` for download headers and distribution instructions. The included server serves the downloadable file at `/download`.

### Portable Windows executable

Run `npm ci` then `npm run build:windows` to create `downloads/IP-Locator.exe` and its SHA-256 checksum. It embeds the runtime and interface in a single Windows x64 executable. Users double-click it; it opens their default browser against a local-only server. Closing the console quits the app. No installation or administrator access is required. The executable is unsigned. See `downloads/WINDOWS-README.txt` for requirements.

Upload the executable bytes to your database or file storage. Serve them with `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="IP-Locator.exe"`. The included web server implements `/download/windows` after the executable is built. Database storage needs a download route or storage URL to make those bytes accessible to users. Building locally does not create a public URL.

The Windows build workflow runs the actual executable on a Windows runner and publishes a downloadable Actions artifact after the checks pass. It runs when pushed to `main`, or manually through GitHub Actions. This workflow has not been run by the local Linux build.

`npm run test:browser` verifies the styled page and lookup interaction in Chromium with simulated location responses, covering LF, Windows CRLF, and bare CR files. Install the test browser with `npx playwright install chromium` first, or set `BROWSER_EXECUTABLE_PATH` to an installed Chromium. The Windows workflow also runs `npm run test:browser -- --exe` against the packaged executable. Live provider verification is a separate Windows workflow check.

## Develop and run

Requires Node.js 24.5 or newer. No dependencies or API keys are required.

```sh
npm start
# Development with automatic server restart:
npm run dev
# Server and API tests:
npm test
```

The server listens on `0.0.0.0:3000`. Set `PORT` for cloud platforms. Deploy this repository to a Node-compatible host with `npm start` as the start command; use the host's HTTPS endpoint. Startup automatically bundles styles and JavaScript into the page. The bundled page also works on static hosts or as a downloaded HTML file using browser-side provider comparisons; its viewer must allow JavaScript and outbound HTTPS to ipapi.co.

Edit `scripts/index.template.html`, `public/style.css`, and `public/app.js`, and `public/lookup.js`, then run `npm run build` to refresh `public/index.html`. IP addresses may include a port, such as `104.26.5.123:443` or `[2001:4860:4860::8888]:443`.

Both the backend and standalone browser fallback query `ipwho.is` and `ipapi.co` for location estimates, and `dns.google` for reverse DNS. These hosts need outbound HTTPS access. Browsers need access to `www.openstreetmap.org` for embedded maps. Looked-up addresses are sent to both location providers and to Google Public DNS; map coordinates are sent to OpenStreetMap. This app does not persist lookups. IP geolocation is approximate and cannot identify an exact street address. Private and reserved addresses do not have public location data.

The public provider has usage limits; check its current terms before commercial or high-volume deployment. For public production deployments, configure request rate limits at your hosting reverse proxy to avoid exhausting the provider quota. Provider errors are handled without exposing internal details.

Startup enables Node's environment proxy support so provider requests respect HTTP_PROXY, HTTPS_PROXY, and NO_PROXY in cloud environments. TLS verification remains enabled.

For a standalone copy, download `public/index.html` and open it in a browser with Internet access. Some embedded visualization viewers block scripts or outbound requests. The page displays an explanation when it can detect those restrictions. Browser provider request limits and terms apply.
