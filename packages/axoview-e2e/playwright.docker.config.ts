import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import type { DockerSmokeOptions } from './tests-docker/fixtures';

/**
 * Playwright config for the built Docker image (ADR 0048; step-by-step plan in
 * docs/tactical/docker-regression-gate.md, items A2 and C3).
 *
 * Run it through the runner, never by hand: `npm run test:e2e:docker` (smoke)
 * or `npm run test:e2e:docker:full` (the regression). scripts/e2e-docker.js
 * builds the image, starts the container on a remapped port, sets the env vars
 * this file reads, and tears everything down afterwards.
 *
 * The dev-server config (playwright.config.ts) and its invariants stay exactly
 * as they are (locked decision 3). That config must never be pointed at a prod
 * bundle; this one is the only config that targets the image.
 *
 * Environment (set by the runner):
 *   - AXOVIEW_BASE_URL     `http://localhost:<port>`, nginx in the container.
 *                          Required: there is no webServer and no fallback, so
 *                          this config can never silently test the dev server.
 *   - AXOVIEW_E2E_OUT      per-run/per-phase output directory (results.json,
 *                          html, blob, and the test artifacts under artifacts/).
 *   - AXOVIEW_REGRESS_RUN  the run id. Added to Chromium's command line as a
 *                          harmless marker switch so the runner's leak audit can
 *                          find this run's browsers by command line.
 *
 * Projects:
 *   - smoke-secure       tests-docker/ (minus the storage-OFF probe) on
 *                        http://localhost:<port>, a secure context.
 *   - smoke-insecure     the journey only, on http://axoview.test:<port>. The
 *                        host-resolver rule below maps that name to 127.0.0.1,
 *                        so Chromium treats it as a plain-HTTP, non-loopback
 *                        origin: an insecure context, where crypto.randomUUID
 *                        does not exist (the v3.9.1 bug class).
 *   - smoke-storage-off  the storage-OFF boot probe (the runner restarts the
 *                        container with ENABLE_SERVER_STORAGE=false for it).
 *   - regression         the full dev suite (./tests), storage OFF, desktop.
 *   - regression-touch   the touch-*.spec.ts files, split exactly as in
 *                        playwright.config.ts.
 *
 * The smoke projects run the image as shipped: no `storageState`, so the store
 * bridge stays off and tests-docker/fixtures.ts asserts `window.__axoview__ ===
 * undefined`. Only the regression projects turn the bridge on, through the
 * existing runtime flag `axoview_perf_enabled='1'` (ADR 0048 §4). There is no
 * CI-only build flag.
 */

const rawBaseURL = process.env.AXOVIEW_BASE_URL;
if (!rawBaseURL) {
  throw new Error(
    'playwright.docker.config.ts: AXOVIEW_BASE_URL is unset. Run the Docker suite through ' +
      '`npm run test:e2e:docker` (scripts/e2e-docker.js), which starts the container and sets it. ' +
      'This config has no webServer and never falls back to the dev server on :3000.'
  );
}
const base = new URL(rawBaseURL);
// ADR 0048 §2: the host port must be remapped. `80` hides the port half of the
// Origin gate (nginx `$host` vs `$http_host`); `3000` equals the backend's
// default ALLOWED_ORIGINS, so the gate always passes there.
if (!base.port || base.port === '80' || base.port === '3000') {
  throw new Error(
    `playwright.docker.config.ts: AXOVIEW_BASE_URL must carry a remapped port that is neither 80 nor 3000 (got ${rawBaseURL}).`
  );
}
const secureURL = base.origin;
const insecureURL = `http://axoview.test:${base.port}`;

const outDir = path.resolve(
  process.env.AXOVIEW_E2E_OUT || path.join(__dirname, 'test-results', 'docker-adhoc')
);
const runId = process.env.AXOVIEW_REGRESS_RUN;

const launchArgs = ['--host-resolver-rules=MAP axoview.test 127.0.0.1'];
if (runId) launchArgs.push(`--axoview-regress-run=${runId}`);

// ADR 0048 §4: the runtime flag that exposes `window.__axoview__` on a prod
// bundle. Regression projects only; the fixtures never clear it (they remove
// five named keys and never call localStorage.clear()), so it survives.
const bridgeStorageState = {
  cookies: [],
  origins: [
    {
      origin: secureURL,
      localStorage: [{ name: 'axoview_perf_enabled', value: '1' }]
    }
  ]
};

// Fixture options for the smoke projects (tests-docker/fixtures.ts). The loopback
// URL is what Node-side API calls use: Chromium's host-resolver rule does not
// reach Node, so `http://axoview.test:<port>` would not resolve there.
const smoke = (opts: Omit<DockerSmokeOptions, 'apiURL'>): DockerSmokeOptions => ({
  apiURL: secureURL,
  ...opts
});

export default defineConfig<DockerSmokeOptions>({
  // One stream, one worker, no retries: the runner contract (tactical, "Runner
  // contract" item 6) and the same sharding invariant as the dev config —
  // fullyParallel:false keeps every spec file inside one shard.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['json', { outputFile: path.join(outDir, 'results.json') }],
    ['html', { outputFolder: path.join(outDir, 'html'), open: 'never' }],
    ...(process.env.CI ? ([['blob', { outputDir: path.join(outDir, 'blob') }]] as const) : [])
  ],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: { args: launchArgs }
  },

  // A sibling of the reporter folders, never their parent: Playwright empties
  // the output directory at startup, and the HTML reporter refuses a folder
  // that overlaps it.
  outputDir: path.join(outDir, 'artifacts'),

  projects: [
    {
      name: 'smoke-secure',
      testDir: './tests-docker',
      // The storage-OFF probe needs a container started with storage OFF; it
      // gets its own project and its own container.
      testIgnore: /boot-storage-off\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: secureURL,
        ...smoke({ expectSecureContext: true, expectServerStorage: true })
      }
    },
    {
      name: 'smoke-insecure',
      testDir: './tests-docker',
      testMatch: /journey\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: insecureURL,
        ...smoke({ expectSecureContext: false, expectServerStorage: true })
      }
    },
    {
      name: 'smoke-storage-off',
      testDir: './tests-docker',
      testMatch: /boot-storage-off\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: secureURL,
        ...smoke({ expectSecureContext: true, expectServerStorage: false })
      }
    },
    // C3 — the full suite against the image, storage OFF (ADR 0048 §3). The
    // touch split mirrors playwright.config.ts's chromium / chromium-touch
    // projects exactly.
    {
      name: 'regression',
      testDir: './tests',
      testIgnore: /touch-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: secureURL,
        storageState: bridgeStorageState
      }
    },
    {
      name: 'regression-touch',
      testDir: './tests',
      testMatch: /touch-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        hasTouch: true,
        baseURL: secureURL,
        storageState: bridgeStorageState
      }
    }
  ]
});
