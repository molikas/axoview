import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated Playwright config for the engine perf harness (PHASE 0 of
 * docs/tactical/perf-charter.md). Separate from the functional e2e config so
 * the perf run owns its own server lifecycle and never shares a worker with
 * the journey suite.
 *
 * Build gotcha (charter, "Environment notes"): axoview-app resolves
 * axoview-lib from `dist/`, NOT source — so a stale dev server silently
 * measures the OLD lib. We bake the fix into webServer.command: build the lib
 * FIRST, then start the dev server, and (by default) do NOT reuse an existing
 * server, so every harness run measures the freshly-built lib. Set
 * PERF_REUSE=1 to reuse a server you know is current (faster dev iteration).
 *
 * NODE_ENV=development is required: the debug bridge (window.__axoview__) that
 * the harness drives is tree-shaken out of production builds (Axoview.tsx).
 * `npm run dev` sets it via cross-env.
 */
const REUSE = !!process.env.PERF_REUSE;

export default defineConfig({
  testDir: '.',
  testMatch: /engine-perf\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The harness loops N ∈ {25..1000} × {spawn,drag} × ≥8 repeats inside one
  // test; give it room. Server build+boot is covered by the webServer timeout.
  timeout: 30 * 60_000,
  reporter: [['list']],

  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    // A fixed, deterministic viewport so frame cost is comparable run-to-run.
    // MUST come after the device spread — Desktop Chrome sets its own
    // viewport/deviceScaleFactor, so spreading it last would silently overwrite
    // these (the harness would run at 1280×720, not the intended 1440×900).
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Tracing/video add main-thread + IO overhead that pollutes frame timing.
    // Opt in explicitly when profiling a single scenario (PERF_TRACE=1).
    trace: process.env.PERF_TRACE ? 'on' : 'off',
    video: 'off',
    screenshot: 'off',
    // Expose window.gc so the harness can force a collection between runs and
    // before each capture — removes GC-pause variance. (Tried disabling vsync
    // for continuous sub-frame timing: headless Chromium keeps a 60 Hz virtual
    // display regardless, and the throttling-disable flags only added variance.)
    launchOptions: { args: ['--js-flags=--expose-gc'] }
  },

  // The Desktop Chrome device + the deterministic viewport override both live in
  // `use` above; the project must NOT re-spread the device here or it would
  // overwrite the viewport again (project.use merges over config.use).
  projects: [{ name: 'perf-chromium' }],

  webServer: {
    command: 'npm run build:lib && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: REUSE,
    timeout: 4 * 60_000,
    cwd: '../..'
  },

  outputDir: './perf-test-results'
});
