/**
 * Fixtures for the Docker smoke (ADR 0048 §2; docs/tactical/docker-regression-gate.md A4).
 *
 * These specs test the image exactly as users receive it, so they never touch
 * the store bridge: no helpers/store.ts, and nothing that reads
 * `window.__axoview__`. They drive the DOM (data-axoview-id hooks via
 * helpers/selectors.ts and the bridge-free POMs) and the HTTP API only.
 *
 * Every test gets two automatic fixtures:
 *
 *   - `apiLog` watches every page of the test's browser context (and any page
 *     a test hands it) and fails the test on
 *       · any `/api/*` response >= 400 the test did not declare with `allow()`;
 *       · any `pageerror` (an uncaught exception in the app, e.g.
 *         `crypto.randomUUID is not a function` on an insecure origin).
 *
 *   - `smokeBoot` asserts the preconditions before the test body runs. A
 *     precondition that silently fails turns the check into a false green
 *     (ADR 0048 §2), so each one is asserted, not assumed:
 *       · the `/app` response carries nginx's `Server` header (the image, not a
 *         dev server);
 *       · `window.__axoview__ === undefined` (the bridge is off as shipped; a
 *         prod bundle that starts leaking it fails here);
 *       · `window.isSecureContext` matches the project;
 *       · `/api/config` answers 200 and its `serverStorage` matches the
 *         container's storage mode.
 *
 * The expected secure-context and storage mode come from the project's `use`
 * block in playwright.docker.config.ts, never from guessing at the URL.
 */
import {
  test as base,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Response
} from '@playwright/test';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';

export type DockerSmokeOptions = {
  /** `true` on http://localhost:<port>, `false` on http://axoview.test:<port>. */
  expectSecureContext: boolean;
  /** The container's storage mode (the runner sets ENABLE_SERVER_STORAGE). */
  expectServerStorage: boolean;
  /**
   * Loopback origin for Node-side API calls (`http://localhost:<port>`).
   * Chromium's `--host-resolver-rules` does not reach Node, so the request API
   * cannot resolve `axoview.test`.
   */
  apiURL: string;
};

/**
 * Same flags, same seeding as fixtures/app.fixture.ts `ONBOARDING_DISMISS_FLAGS`.
 * Copied rather than imported: app.fixture.ts imports helpers/store.ts (the
 * bridge), which the smoke must not load. On a prod image the welcome card's ✕
 * has no stable selector, so the flag is seeded, never clicked.
 */
const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

export async function seedOnboardingFlags(context: BrowserContext): Promise<void> {
  await context.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

/** Empty state or canvas, whichever this boot lands on (as app.fixture.ts). */
export async function waitForAppReady(page: Page): Promise<void> {
  await Promise.race([
    byAxoviewId(page, 'screen-empty-create').waitFor({ state: 'visible', timeout: 15_000 }),
    byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 })
  ]);
}

export type ApiEntry = { method: string; path: string; url: string; status?: number };

/** Records `/api/*` traffic and uncaught page errors for every watched page. */
export class ApiLog {
  readonly requests: ApiEntry[] = [];
  readonly responses: ApiEntry[] = [];
  readonly violations: string[] = [];
  private readonly allowed: Array<(entry: ApiEntry) => boolean> = [];
  private readonly watched = new WeakSet<Page>();

  /** Declare an `/api/*` error response this test expects. */
  allow(predicate: (entry: ApiEntry) => boolean): void {
    this.allowed.push(predicate);
  }

  watch(page: Page): void {
    if (this.watched.has(page)) return;
    this.watched.add(page);
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (!url.pathname.startsWith('/api/')) return;
      this.requests.push({ method: req.method(), path: url.pathname, url: req.url() });
    });
    page.on('response', (res: Response) => {
      const url = new URL(res.url());
      if (!url.pathname.startsWith('/api/')) return;
      const entry: ApiEntry = {
        method: res.request().method(),
        path: url.pathname,
        url: res.url(),
        status: res.status()
      };
      this.responses.push(entry);
      if (res.status() >= 400 && !this.allowed.some((allow) => allow(entry))) {
        this.violations.push(`${entry.method} ${entry.url} -> ${res.status()}`);
      }
    });
    page.on('pageerror', (err) => {
      this.violations.push(`pageerror on ${page.url()}: ${err.message}`);
    });
  }

  watchContext(context: BrowserContext): void {
    for (const page of context.pages()) this.watch(page);
    context.on('page', (page) => this.watch(page));
  }
}

/**
 * Wait for one `/api/*` response. `path` is matched against the pathname only,
 * so the origin (localhost or axoview.test) doesn't matter.
 */
export function waitForApi(
  page: Page,
  method: string,
  path: string | RegExp,
  timeout = 15_000
): Promise<Response> {
  return page.waitForResponse(
    (res) => {
      if (res.request().method() !== method) return false;
      const pathname = new URL(res.url()).pathname;
      return typeof path === 'string' ? pathname === path : path.test(pathname);
    },
    { timeout }
  );
}

/**
 * Storage ON: start every test from an empty server. The runner gives each run
 * its own labelled volume, so nothing here belongs to anyone else. Node-side, no
 * `Origin` header: the backend admits requests without one (curl, server to
 * server), which is also why this can't stand in for a browser write.
 */
export async function wipeServerDiagrams(api: APIRequestContext): Promise<void> {
  const list = await api.get('/api/diagrams');
  expect(list.status(), 'GET /api/diagrams with storage ON').toBe(200);
  const diagrams = (await list.json()) as Array<{ id: string }>;
  for (const d of diagrams) {
    const res = await api.delete(`/api/diagrams/${encodeURIComponent(d.id)}`);
    expect([200, 404], `DELETE /api/diagrams/${d.id}`).toContain(res.status());
  }
}

/**
 * A DOM-only edit: drag the first Elements-panel icon onto the canvas. Same
 * mouse sequence as smoke.spec.ts `placeIcon` (Locator.dragTo trips over the
 * icon's MUI Tooltip), without the bridge.
 */
export async function placeFirstIcon(page: Page, x = 380, y = 280): Promise<void> {
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await gridItem.isVisible().catch(() => false))) {
    await byAxoviewId(page, 'dock-elements-toggle').click();
  }
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
  const iconBox = await gridItem.boundingBox();
  const canvasBox = await byLibTestId(page, 'axoview-canvas').boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeFirstIcon: icon or canvas has no bounding box');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + x, canvasBox.y + y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

type SmokeFixtures = {
  api: APIRequestContext;
  apiLog: ApiLog;
  smokeBoot: void;
};

export const test = base.extend<SmokeFixtures & DockerSmokeOptions>({
  expectSecureContext: [true, { option: true }],
  expectServerStorage: [true, { option: true }],
  apiURL: ['', { option: true }],

  api: async ({ apiURL }, use) => {
    if (!apiURL) {
      throw new Error('apiURL is unset: run tests-docker through playwright.docker.config.ts');
    }
    const api = await playwrightRequest.newContext({ baseURL: apiURL });
    await use(api);
    await api.dispose();
  },

  apiLog: [
    async ({ context }, use) => {
      const log = new ApiLog();
      log.watchContext(context);
      await use(log);
      expect(log.violations, 'undeclared /api/* errors (>= 400) or uncaught page errors').toEqual([]);
    },
    { auto: true }
  ],

  smokeBoot: [
    async ({ page, context, api, apiLog, expectSecureContext, expectServerStorage }, use) => {
      apiLog.watch(page);
      if (expectServerStorage) await wipeServerDiagrams(api);
      await seedOnboardingFlags(context);

      const response = await page.goto('/app');
      expect(response, 'navigation to /app returned no response').not.toBeNull();
      expect(response!.status(), 'GET /app').toBe(200);
      expect(
        response!.headers()['server'] ?? '',
        'the /app response must come from nginx in the image, not a dev server'
      ).toMatch(/^nginx/i);

      await waitForAppReady(page);

      const probe = await page.evaluate(async () => {
        const res = await fetch('/api/config', { cache: 'no-store' });
        const body = res.ok ? ((await res.json()) as { serverStorage?: unknown }) : null;
        return {
          bridgeAbsent: (window as unknown as { __axoview__?: unknown }).__axoview__ === undefined,
          secure: window.isSecureContext,
          status: res.status,
          serverStorage: body ? body.serverStorage : undefined
        };
      });
      expect(probe.bridgeAbsent, 'window.__axoview__ must be undefined on the image as shipped').toBe(true);
      expect(probe.secure, 'window.isSecureContext for this project').toBe(expectSecureContext);
      expect(probe.status, 'GET /api/config through nginx').toBe(200);
      expect(probe.serverStorage, "/api/config serverStorage vs the container's storage mode").toBe(
        expectServerStorage
      );

      await use();
    },
    { auto: true }
  ]
});

export { expect };
