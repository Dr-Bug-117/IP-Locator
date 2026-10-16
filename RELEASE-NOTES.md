Portable IP Locator for Windows 10/11 x64. Download **IP-Locator.exe** below, then double-click it. No installer, Node.js installation, or administrator access is required.

Version 1.0.1 fixes the unstyled page and unresponsive Locate IP button caused by Windows line endings invalidating the page's security hashes. Browser regression checks now cover Windows line endings and the packaged executable.

Version 1.0.2 fixes a Windows test-cleanup race that prevented release publishing after those browser checks passed. Cleanup now waits for the application to exit before removing its temporary working directory.

The app opens in your default browser. Keep its console window open while using it; close that window to quit. Internet access is required for public IPv4/IPv6 geolocation and OpenStreetMap maps. Addresses with ports, such as `104.26.5.123:443`, are supported.

IP locations are approximate and may reflect a VPN or network provider. Queries are sent to ipwho.is or ipapi.co; map coordinates are sent to OpenStreetMap. The application does not store lookup history.

The executable is unsigned, so Windows may display a publisher warning. A SHA-256 checksum and user instructions are included as separate downloads.
