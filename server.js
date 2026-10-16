import http from 'node:http';
import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectEvidence } from './public/providers.js';
import { collectIntelligence } from './public/intelligence.js';

export function parseAddress(value) {
  const address = value.trim();
  if (isIP(address)) return address;
  const match = address.match(/^(?:\[([^\]]+)\]|(\d{1,3}(?:\.\d{1,3}){3})):(\d{1,5})$/);
  if (!match || Number(match[3]) > 65535) return '';
  const ip = match[1] || match[2];
  return isIP(ip) ? ip : '';
}

export function createServer({ fetcher = fetch, page } = {}) {
  const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-src https://www.openstreetmap.org; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (req.method !== 'GET') return send(405, { error: 'Only GET requests are supported.' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/download/windows') {
      try {
        const content = await readFile(new URL('./downloads/IP-Locator.exe', import.meta.url));
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="IP-Locator.exe"',
          'Content-Length': content.length,
          'Cache-Control': 'no-cache',
        });
        res.end(content);
      } catch { send(503, { error: 'Windows download not built. Run npm run build:windows.' }); }
      return;
    }
    if (url.pathname === '/download') {
      try {
        const content = page ? Buffer.from(page) : await readFile(new URL('./downloads/IP-Locator.html', import.meta.url));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="IP-Locator.html"',
          'Content-Length': content.length,
          'Cache-Control': 'no-cache',
        });
        res.end(content);
      } catch { send(503, { error: 'Download not built. Run npm run build.' }); }
      return;
    }
    if (url.pathname === '/api/lookup' || url.pathname === '/api/intelligence') {
      const ip = parseAddress(url.searchParams.get('ip') || '');
      if (!isIP(ip)) return send(400, { error: 'Enter a valid IPv4 or IPv6 address.' });
      try {
        send(200, await (url.pathname === '/api/intelligence' ? collectIntelligence(ip, fetcher) : collectEvidence(ip, fetcher)));
      } catch (error) {
        send(error.status || 502, { error: error.status ? error.message : 'The location service is unavailable. Please try again shortly.' });
      }
      return;
    }
    const file = files[url.pathname];
    if (!file) return send(404, { error: 'Not found.' });
    try {
      if (page && file[0] !== 'index.html') return send(404, { error: 'Not found.' });
      const content = page ? Buffer.from(page) : await readFile(new URL(`./public/${file[0]}`, import.meta.url));
      if (file[0] === 'index.html') {
        const html = content.toString();
        // HTML parsing normalizes Windows CRLF and bare CR before checking CSP hashes.
        const hash = text => `'sha256-${createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('base64')}'`;
        const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
        const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
        res.setHeader('Content-Security-Policy', `default-src 'self'; connect-src 'self' https://ipapi.co https://ipwho.is https://dns.google https://api.ipapi.is https://rdap.org https://rdap.arin.net https://rdap.db.ripe.net https://rdap.apnic.net https://rdap.lacnic.net https://rdap.afrinic.net https://stat.ripe.net; frame-src https://www.openstreetmap.org; style-src 'self' ${hash(style)}; script-src 'self' ${hash(script)}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`);
      }
      res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
      res.end(content);
    } catch { send(500, { error: 'Unable to load the application.' }); }
  });
}

