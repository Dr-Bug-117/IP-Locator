# IP Locator

A responsive web application for looking up the approximate geographic location of public IPv4 and IPv6 addresses. Displays city, country, region, coordinates, timezone, ISP, ASN, and an OpenStreetMap map.

## Downloadable application

Run `npm run build` to generate `downloads/IP-Locator.html`. Upload that single file to your file storage or database-backed download route. Users download and open it in their desktop browser; no server installation is needed on their computer. Internet access is required for lookups and maps. See `downloads/UPLOAD-GUIDE.md` for download headers and distribution instructions. The included server serves the downloadable file at `/download`.

### Portable Windows executable

Run `npm ci` then `npm run build:windows` to create `downloads/IP-Locator.exe` and its SHA-256 checksum. It embeds the runtime and interface in a single Windows x64 executable. Users double-click it; it opens their default browser against a local-only server. Closing the console quits the app. No installation or administrator access is required. The executable is unsigned. See `downloads/WINDOWS-README.txt` for requirements.

Upload the executable bytes to your database or file storage. Serve them with `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="IP-Locator.exe"`. The included web server implements `/download/windows` after the executable is built. Database storage needs a download route or storage URL to make those bytes accessible to users. Building locally does not create a public URL.

The Windows build workflow runs the actual executable on a Windows runner and publishes a downloadable Actions artifact after the checks pass. It runs when pushed to `main`, or manually through GitHub Actions. This workflow has not been run by the local Linux build.

## Develop and run

Requires Node.js 24.5 or newer. No dependencies or API keys are required.

```sh
npm start
# Development with automatic server restart:
npm run dev
# Server and API tests:
npm test
```

The server listens on `0.0.0.0:3000`. Set `PORT` for cloud platforms. Deploy this repository to a Node-compatible host with `npm start` as the start command; use the host's HTTPS endpoint. Startup automatically bundles styles and JavaScript into the page. The bundled page also works on static hosts or as a downloaded HTML file using a browser-side provider fallback; its viewer must allow JavaScript and outbound HTTPS to ipapi.co.

Edit `scripts/index.template.html`, `public/style.css`, and `public/app.js`, and `public/lookup.js`, then run `npm run build` to refresh `public/index.html`. IP addresses may include a port, such as `104.26.5.123:443` or `[2001:4860:4860::8888]:443`.

The backend needs outbound HTTPS to `ipwho.is`. Standalone and static-hosted pages use `ipapi.co` when the backend is unavailable. Browsers need access to `www.openstreetmap.org` for embedded maps. Looked-up addresses are sent to ipwho.is by the backend or ipapi.co by the browser; map coordinates are sent to OpenStreetMap. This app does not persist lookups. IP geolocation is approximate and cannot identify an exact street address. Private and reserved addresses do not have public location data.

The public provider has usage limits; check its current terms before commercial or high-volume deployment. For public production deployments, configure request rate limits at your hosting reverse proxy to avoid exhausting the provider quota. Provider errors are handled without exposing internal details.

Startup enables Node's environment proxy support so provider requests respect HTTP_PROXY, HTTPS_PROXY, and NO_PROXY in cloud environments. TLS verification remains enabled.

For a standalone copy, download `public/index.html` and open it in a browser with Internet access. Some embedded visualization viewers block scripts or outbound requests. The page displays an explanation when it can detect those restrictions. Browser provider request limits and terms apply.
