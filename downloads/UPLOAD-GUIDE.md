# Distribute IP Locator

## Portable Windows app (requested distribution)

Upload `IP-Locator.exe` to your database or file storage. Users download that one file and double-click it; no installer or separate runtime is required. It opens the included design in their default browser. Keep its console window open while using it, and close that window to quit.

Serve the exact executable bytes with:

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="IP-Locator.exe"
```

The included server provides `/download/windows` after `npm run build:windows`. Build output is approximately 55 MB. The binary is ignored by Git; use the Windows GitHub Actions build artifact for repository-based distribution. No build has been pushed or published automatically.

The executable was cross-built on Linux. Its embedded app was smoke-tested from an empty folder, and the download route was verified against the executable bytes. The executable still needs a real Windows run; the provided Windows Actions workflow performs that test. See `WINDOWS-README.txt` for user instructions.

## Optional HTML-only version

Upload `IP-Locator.html` from this directory to your database, object storage, or website's file storage. It includes the design, styles, and application code in one file. Rebuild it with `npm run build` after changing the app.

## User experience

1. User visits your download address.
2. Their browser downloads `IP-Locator.html`.
3. User opens the file in Chrome, Edge, Firefox, or Safari on a desktop computer.
4. User enters a public IPv4 or IPv6 address and chooses Locate IP.

This is a portable browser app, not an EXE, APK, or native installer. It requires no Node.js installation for the person using the downloaded file. Internet access is required for location data and maps. Mobile operating systems may preview downloaded HTML without allowing scripts; use a hosted web copy on those devices.

## Serve the file as a download

Store the file's exact bytes as a file/blob and have your download route return them with these HTTP response headers:

```http
Content-Type: text/html; charset=utf-8
Content-Disposition: attachment; filename="IP-Locator.html"
```

A database row alone does not create a public address. Your website needs a download route or your file storage needs a downloadable public/signed URL. Return the file bytes rather than a JSON record containing the file.

The included Node server already implements `GET /download` with these headers. Once deployed, link your download button to `/download`. No public hosting URL is created by building this project.

For an HTML download hosted on a different origin, use the Content-Disposition header above; an HTML `download` attribute alone may be ignored across origins.

## Connectivity and privacy

The app sends the entered IP address to `https://ipwho.is` and `https://ipapi.co` for comparison estimates, and `https://dns.google` for reverse DNS. Its map sends coordinates to OpenStreetMap. It does not save lookup history. Provider usage limits and terms apply. Firewalls, browser extensions, or a sandboxed document viewer may block requests; the app reports connection errors.

## Verification status

The standalone user interaction was tested in Chromium with a simulated provider response. Server/API automated tests pass. Live browser-provider access was blocked in the development environment, so verify a real lookup in your target browser before distributing it to users.
