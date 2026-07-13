// Local preview that serves ./build the way Cloudflare Pages does under R1
// (ADR 0040): marketing landing at /, editor SPA at /app, clean URLs, legacy
// /display/* redirects, and a real 404. Cloudflare `_redirects` and clean-URL
// handling can't be reproduced by `rsbuild dev`, so this is the canonical way to
// test the full routing locally:
//
//   npm run build && node scripts/preview-r1.mjs   (or: npm run preview:r1)
//
// Then visit http://localhost:4599/ (landing) and /app (editor).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(__dirname, '../build');
const PORT = Number(process.env.PORT) || 4599;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

if (!existsSync(path.join(BUILD, 'app.html'))) {
  console.error('[preview] build/ not found or not R1 — run `npm run build` first.');
  process.exit(1);
}

async function send(res, file, status = 200) {
  const buf = await readFile(file);
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(buf);
}
const safe = (p) => { const f = path.join(BUILD, p); return f.startsWith(BUILD) ? f : null; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(url.pathname);

  // 1) Real file (or clean-URL .html) — served first, like Pages.
  const direct = safe(p === '/' ? '/index.html' : p);
  if (direct && existsSync(direct) && !direct.endsWith(path.sep)) {
    try { return await send(res, direct); } catch { /* fall through */ }
  }
  const asHtml = safe(p + '.html');
  if (asHtml && existsSync(asHtml)) { try { return await send(res, asHtml); } catch { /* */ } }

  // 2) _redirects rules.
  if (p.startsWith('/display/')) {                        // legacy share links
    res.writeHead(301, { location: '/app' + p }); return res.end();
  }
  if (p === '/app' || p.startsWith('/app/')) {            // SPA shell
    return send(res, path.join(BUILD, 'app.html'), 200);
  }
  // 3) Genuine 404.
  return send(res, path.join(BUILD, '404.html'), 404);
});

server.listen(PORT, () => {
  console.log(`[preview] R1 preview of build/ at http://localhost:${PORT}`);
  console.log('[preview]   /       → marketing landing');
  console.log('[preview]   /app    → editor SPA');
  console.log('[preview]   /privacy /terms → legal · /anything-else → 404');
});
