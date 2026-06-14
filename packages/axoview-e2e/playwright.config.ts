import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the T1 rewrite suite.
 *
 * Scope (see docs/tactical/e2e-suite-rewrite.md):
 *   - Chromium only for the initial green; Firefox/WebKit may land post-M9.
 *   - One project, one testDir; per-journey spec files live under ./tests.
 *   - Retries=0 locally and in CI for now — flake hunting comes in Session 8.
 *   - webServer auto-starts `npm run dev` from the repo root; reuses an
 *     existing server when the dev port is already bound.
 *   - workers=1: shared dev server, sequential rsbuild HMR clients. Parallel
 *     contexts overwhelm the dev pipeline (Loading-Axoview stall observed
 *     Session 3 with 2 parallel workers); revisit in Session 8 if/when the
 *     CI build serves a precompiled bundle instead.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
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
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: '../..'
  },

  outputDir: './test-results'
});
