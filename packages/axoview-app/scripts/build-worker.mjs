// Advanced-mode Pages worker build (ADR 0046 §2 / D1 resolution 2026-07-21).
//
// Cloudflare Pages *file-based* Functions (functions/**) strip non-onRequest
// exports, so the AGENT_SESSION Durable Object class is tree-shaken and the DO
// cannot deploy. Durable Objects require Pages "Advanced Mode": a single
// build/_worker.js that exports `default { fetch }` PLUS the DO class. When
// _worker.js is present Pages ignores functions/ and runs this instead.
//
// The Hono app (packages/axoview-worker/src/app.ts) is already a valid module
// worker — `export default app` (the {fetch} handler) + `export { AgentSessionDO }`
// — so we just bundle it. Same code the /api Drive proxy already runs; _routes.json
// still gates which requests invoke the worker vs. static assets.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '../..');
const entry = path.join(repoRoot, 'packages/axoview-worker/src/app.ts');
const outfile = path.join(appRoot, 'build/_worker.js');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // Resolve the Workers/edge entry points of deps (hono), not the browser DOM ones.
  conditions: ['workerd', 'worker', 'browser'],
  // cloudflare:* built-ins are provided by the runtime.
  external: ['cloudflare:*'],
  outfile,
  logLevel: 'warning'
});

console.log(`[build-worker] wrote ${path.relative(repoRoot, outfile)}`);
