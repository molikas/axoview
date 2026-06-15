/**
 * Base app fixture. Loads `/`, waits for either the EmptyStateScreen or the
 * canvas to mount (covers both first-run and resumed-diagram boots), and
 * dismisses any onboarding/import tooltip overlays.
 *
 * Tests that need a clean storage starting point should clear it via
 * `page.addInitScript` BEFORE invoking the fixture — the fixture itself
 * preserves whatever state localStorage carries so suites can opt into
 * persisted-state scenarios (e.g. the J1 reopen leg).
 *
 * `canvasReadyTest` is the DP4-locked (v1.1-test-coverage tactical
 * 2026-05-25) extension that centralises the boot-blank-diagram cycle
 * that rename/shapes/connector/canvas-modes specs each duplicate today.
 * New canvas-cross-interaction specs (5e, 5f, 5h) consume this directly
 * — the existing specs stay on their inline boots until their next edit.
 */
import { test as base, Page } from '@playwright/test';
import { waitForDebugBridge } from '../helpers/store';

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

// T2 node-layer Canvas2D gate switch (mirrors the perf harness's PERF_CANVAS).
// When AXOVIEW_CANVAS_NODES=1, set the `axoview-canvas-nodes` localStorage flag
// before each navigation so the Renderer mounts the Canvas2D node layer instead
// of the DOM node renderer. Lets the correctness gate run flag-ON
// (`AXOVIEW_CANVAS_NODES=1 npx playwright test ...`) without touching any spec.
// Off (the default) → byte-identical to the DOM path, so the committed gate is
// unchanged.
async function applyCanvasNodesFlag(page: Page) {
  if (process.env.AXOVIEW_CANVAS_NODES !== '1') return;
  await page.addInitScript(() => {
    try {
      localStorage.setItem('axoview-canvas-nodes', '1');
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  });
}

export class AppPage {
  constructor(readonly page: Page) {}

  async dismissHintTooltips() {
    // ConnectorHintTooltip + ImportHintTooltip dismiss on any interaction;
    // Escape is the lightest path that doesn't accidentally trigger a menu.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(150);
  }
}

async function waitForAppReady(page: Page) {
  // Either the empty state OR the canvas must be visible — they're mutually
  // exclusive, so a `:visible` race resolves on whichever boot path the
  // current localStorage carries.
  await Promise.race([
    page.locator('[data-axoview-id="screen-empty-create"]').waitFor({ state: 'visible', timeout: 15_000 }),
    page.locator('[data-testid="axoview-canvas"]').waitFor({ state: 'visible', timeout: 15_000 })
  ]);
}

export const appTest = base.extend<{ app: AppPage }>({
  app: async ({ page }, use) => {
    await applyCanvasNodesFlag(page);
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDebugBridge(page);
    const app = new AppPage(page);
    await app.dismissHintTooltips();
    await use(app);
  }
});

/**
 * Canvas-ready fixture (DP4): boots to a freshly-created blank diagram so
 * the canvas surface is mounted, the debug bridge is attached, and the
 * onboarding tooltips are dismissed before the test body runs. Idempotent
 * across runs because `LOCAL_STORAGE_KEYS` is cleared post-navigation and
 * the empty-state Create button is clicked unconditionally.
 *
 * The two-step navigate(`/`) → clearStorage → reload sequence is necessary
 * because clearing localStorage requires a navigation to the origin first
 * (Playwright cannot evaluate against `about:blank`).
 */
export const canvasReadyTest = base.extend<{ app: AppPage }>({
  app: async ({ page }, use) => {
    await applyCanvasNodesFlag(page);
    await page.addInitScript((flags: Array<[string, string]>) => {
      try {
        for (const [k, v] of flags) localStorage.setItem(k, v);
      } catch {
        /* localStorage may not be available pre-navigation */
      }
    }, ONBOARDING_DISMISS_FLAGS);
    await page.goto('/');
    await page.evaluate((keys: string[]) => {
      for (const k of keys) localStorage.removeItem(k);
    }, LOCAL_STORAGE_KEYS);
    await page.reload();
    const createBtn = page.locator('[data-axoview-id="screen-empty-create"]');
    await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await createBtn.click();
    await page
      .locator('[data-testid="axoview-canvas"]')
      .waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    const app = new AppPage(page);
    await app.dismissHintTooltips();
    await use(app);
  }
});

export { expect } from '@playwright/test';
