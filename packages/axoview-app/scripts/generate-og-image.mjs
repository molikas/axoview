// Generates public/og-image.png — the 1200x630 social-sharing card (ADR 0041).
//
// Why Playwright: it is already a workspace dependency (axoview-e2e) and renders
// crisp anti-aliased text to an exact viewport, so we get a real PNG without
// pulling in sharp/canvas. Run: `node scripts/generate-og-image.mjs`.
// Re-run whenever the design below changes. The output is a *branded placeholder*
// (ADR 0041 locked decision #4) — swap it for a polished asset later, same path.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../public/og-image.png');

// 1.91:1 — the Open Graph / Twitter summary_large_image ratio. Rendered at
// deviceScaleFactor 1 so the file dimensions match the og:image:width/height meta.
const WIDTH = 1200;
const HEIGHT = 630;

const html = /* html */ `
<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    display: flex; flex-direction: column;
    align-items: flex-start; justify-content: center;
    padding: 0 92px; gap: 26px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1f2937;
    background:
      radial-gradient(1200px 600px at 88% -10%, rgba(37,99,235,0.10), transparent 60%),
      repeating-linear-gradient(30deg,  rgba(100,116,139,0.10) 0, rgba(100,116,139,0.10) 1px, transparent 1px, transparent 34px),
      repeating-linear-gradient(150deg, rgba(100,116,139,0.10) 0, rgba(100,116,139,0.10) 1px, transparent 1px, transparent 34px),
      #ffffff;
    position: relative; overflow: hidden;
  }
  .wordmark { font-size: 132px; font-weight: 700; letter-spacing: -0.01em; line-height: 1; }
  .wordmark .accent { color: #2563eb; }
  .tagline { font-size: 46px; font-weight: 500; color: #475569; max-width: 760px; line-height: 1.18; }
  .chips { display: flex; gap: 14px; margin-top: 8px; }
  .chip {
    font-size: 26px; font-weight: 600; color: #0369a1;
    background: rgba(14,165,233,0.12); border: 1px solid rgba(14,165,233,0.28);
    padding: 8px 20px; border-radius: 999px;
  }
  .cube {
    position: absolute; right: -40px; bottom: -60px; width: 520px; height: 520px;
    opacity: 0.9;
  }
</style></head>
<body>
  <!-- A small isometric stack motif, echoing the product. -->
  <svg class="cube" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.85">
      <path d="M100 20 L160 54 L100 88 L40 54 Z" fill="#2563eb"/>
      <path d="M40 54 L100 88 L100 156 L40 122 Z" fill="#1d4ed8"/>
      <path d="M160 54 L100 88 L100 156 L160 122 Z" fill="#3b82f6"/>
    </g>
    <g opacity="0.55" transform="translate(0,-46)">
      <path d="M100 96 L150 124 L100 152 L50 124 Z" fill="#0ea5e9"/>
      <path d="M50 124 L100 152 L100 196 L50 168 Z" fill="#0284c7"/>
      <path d="M150 124 L100 152 L100 196 L150 168 Z" fill="#38bdf8"/>
    </g>
  </svg>

  <div class="wordmark">Axo<span class="accent">view</span></div>
  <div class="tagline">Beautiful isometric &amp; 2D diagrams, right in your browser.</div>
  <div class="chips">
    <div class="chip">Free</div>
    <div class="chip">Open-source</div>
    <div class="chip">axoview.app</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  console.log(`[og] wrote ${OUT} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
