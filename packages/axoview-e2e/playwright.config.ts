import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the T1 rewrite suite.
 *
 * Scope (see docs/testing.md — "CI execution model — sharding"):
 *   - Chromium only for the initial green; Firefox/WebKit may land post-M9.
 *   - One project, one testDir; per-journey spec files live under ./tests.
 *   - Retries=0 locally and in CI for now — flake hunting comes in Session 8.
 *   - webServer auto-starts `npm run dev` from the repo root; reuses an
 *     existing server when the dev port is already bound.
 *   - workers=1: shared dev server, sequential rsbuild HMR clients. Parallel
 *     contexts overwhelm the dev pipeline (Loading-Axoview stall observed
 *     Session 3 with 2 parallel workers). CI parallelism is achieved instead by
 *     SHARDING across runners (`--shard=i/N`, see e2e-playwright.yml): each
 *     shard keeps workers=1, so within a runner the execution is identical to
 *     the proven local flow — the fan-out is machine-level, not context-level.
 *
 * Reporters: CI emits `blob` so the sharded runs can be merged into one HTML
 * report (playwright merge-reports); `github` adds inline PR annotations.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['blob']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Touch specs run only under the touch-enabled project below.
      testIgnore: /touch-.*\.spec\.ts/
    },
    // ADR 0018 — touch/pen gesture contract. A touch-enabled context for the
    // touch-*.spec.ts files, which drive real pointer/touch input (synthetic
    // dispatch has no setPointerCapture semantics). Scoped via testMatch so the
    // desktop specs do not double-run under touch.
    {
      name: 'chromium-touch',
      use: { ...devices['Desktop Chrome'], hasTouch: true },
      testMatch: /touch-.*\.spec\.ts/
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Reuse a locally-running dev server, but never in CI (each sharded runner
    // starts its own clean server).
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: '../..'
  },

  outputDir: './test-results'
});
