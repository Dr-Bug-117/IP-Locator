Portable IP Locator for Windows 10/11 x64. Download **IP-Locator.exe** below, then double-click it. No installer, Node.js installation, or administrator access is required.

Version 1.2.0 adds an expanded public-IP details panel:

- IPv4/IPv6 canonical, expanded, decimal, hex, binary, reverse-query, and common special-use address facts.
- Network company, categories, ASN, reported routes, hosting/VPN provider, and provider abuse scores when returned by ipapi.is.
- VPN, proxy, Tor, hosting, mobile, crawler, satellite, abuse, and bogon indicators, with Unknown for missing fields. Negative flags are not a clean bill of health.
- RDAP allocation range, CIDRs, handles, allocation status, dates, notices, and public registry/abuse contacts.
- Observed BGP prefix and origin ASNs from RIPEstat.
- Additional provider location/country context, all returned source fields, and a downloadable JSON evidence report.
- External reputation research links for AbuseIPDB, VirusTotal, and Cisco Talos. Detailed histories from these services are not automatically retrieved.

The extra sources load independently of geolocation and may be unavailable or rate-limited. Their public records do not reveal the device, operating system, Windows account, personal files, or exact street address. No target port scanning or device access is performed.

Version 1.1.0 adds a location evidence comparison:

- Side-by-side city, region, country, and coordinate estimates from ipwho.is and ipapi.co.
- Clear disagreement, agreement, incomplete-data, and single-provider states. Agreement does not verify a device location.
- A map selector for inspecting each provider's estimate and the approximate separation between their markers. This separation is not an accuracy radius.
- Reverse-DNS hostname clues through Google Public DNS, clearly separated from geolocation and network ownership.
- Partial results when a provider or DNS lookup is unavailable, and the time providers were checked.

The app cannot reliably resolve a person's actual city from an IP address alone. ISP gateways, VPNs, stale databases, provider limits, and missing DNS records can affect results. No location is inferred from hostname abbreviations.

Version 1.0.3 adds “Developed by Justice Floyd” to the application footer.

Version 1.0.1 fixes the unstyled page and unresponsive Locate IP button caused by Windows line endings invalidating the page's security hashes. Browser regression checks now cover Windows line endings and the packaged executable.

Version 1.0.2 fixes a Windows test-cleanup race that prevented release publishing after those browser checks passed. Cleanup now waits for the application to exit before removing its temporary working directory.

The app opens in your default browser. Keep its console window open while using it; close that window to quit. Internet access is required for public IPv4/IPv6 geolocation and OpenStreetMap maps. Addresses with ports, such as `104.26.5.123:443`, are supported.

IP locations are approximate and may reflect a VPN or network provider. Queries are sent to ipwho.is or ipapi.co; map coordinates are sent to OpenStreetMap. The application does not store lookup history.

The executable is unsigned, so Windows may display a publisher warning. A SHA-256 checksum and user instructions are included as separate downloads.
