/**
 * canvas-modes.spec.ts — Tier 1 J19.
 *
 * J19 (per docs/manual-test-baseline.md): 2D canvas mode toggle. Switches
 * projection cleanly → toggles back → returns to iso.
 *
 * Surface walkthrough:
 *   - The toggle lives in the lib's ToolMenu (ToolMenu.tsx#L156-163), NOT in
 *     the app's AppToolbar. Clicking it dispatches
 *     `uiStateStoreActions.setCanvasMode(canvasMode === 'ISOMETRIC' ? '2D' : 'ISOMETRIC')`.
 *   - The setting is persisted (config/persistedSettings.ts captures it on
 *     subsequent boots) so the spec snapshots the initial value and restores
 *     it post-test rather than asserting against a hardcoded default.
 *   - Post-toggle, ToolMenu's prevCanvasModeRef effect preserves the user's
 *     zoom and viewport center across the projection swap (via
 *     getCanvasModeSwitchScroll) — it no longer force-fits the diagram
 *     (ADR locked decision #6). Zoom/center preservation is covered by
 *     canvas-mode-zoom-preserve.spec.ts; this spec only asserts the toggle flip.
 *
 * Lazy data-axoview-id retrofits this spec (1 lib rebuild):
 *   - LIB `canvas-mode-toggle` (ToolMenu.tsx)
 *     Forwarded to <button> via a new optional `dataAxoviewId` pass-through
 *     prop on src/components/IconButton/IconButton.tsx — keeps existing
 *     call sites untouched, lights up only the surfaces a spec asks for.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
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

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function clearDiagramStorage(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await clearDiagramStorage(page);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

/** Reads `uiState.canvasMode` from the debug bridge. */
const getCanvasMode = (page: import('@playwright/test').Page): Promise<string | null> =>
  page.evaluate(
    () => (window as any).__axoview__?.ui?.getState?.()?.canvasMode ?? null
  );

test.describe('Canvas mode — J19: 2D toggle round-trip', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('J19: toggling canvas mode flips ISOMETRIC ↔ 2D ↔ ISOMETRIC via the ToolMenu button', async ({ page }) => {
    const canvas = new CanvasPOM(page);

    // Snapshot starting mode — persisted between sessions so we can't
    // assume ISOMETRIC unconditionally. The spec restores this at the end.
    const initialMode = await getCanvasMode(page);
    expect(initialMode === 'ISOMETRIC' || initialMode === '2D').toBe(true);

    await expect(canvas.canvasModeToggleButton()).toBeVisible();

    // First toggle — mode flips to the opposite value.
    await canvas.toggleCanvasMode();
    await expect
      .poll(() => getCanvasMode(page), { timeout: 3_000 })
      .toBe(initialMode === 'ISOMETRIC' ? '2D' : 'ISOMETRIC');

    // Second toggle — restores the original value, validating the
    // round-trip contract J19 names.
    await canvas.toggleCanvasMode();
    await expect
      .poll(() => getCanvasMode(page), { timeout: 3_000 })
      .toBe(initialMode);
  });
});
