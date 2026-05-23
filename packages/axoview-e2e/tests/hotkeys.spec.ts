/**
 * hotkeys.spec.ts — Tier 1 J15.
 *
 * J15 (per docs/manual-test-baseline.md): hotkey sanity — Ctrl+S, Ctrl+Z,
 * Ctrl+Y, Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V, Delete. Each does what it claims.
 *
 * One sub-test per hotkey — easier to debug when one fails than a single
 * mega-test with seven assertion groups would be.
 *
 * Assertion strategy:
 *   - Model-level state via the `__axoview__` debug bridge wherever possible
 *     (item count, history depth, selectedIds length) — cleaner than DOM
 *     scraping and resilient to renderer tweaks.
 *   - Ctrl+S: assert the localStorage snapshot at `axoview-last-opened-data`
 *     carries the placed item count. This is the same load-bearing check
 *     the J1 smoke spec uses to verify save semantics.
 *
 * Selection setup for clipboard / Delete tests:
 *   - copy / cut / paste read selection from EITHER LASSO mode's
 *     `mode.selection.items` OR `uiState.itemControls` (single-item
 *     selection). Delete additionally accepts `selectedIds.length > 1`.
 *   - Real-user selection happens by clicking on a placed icon (Cursor.ts
 *     mousedown). The connector spec showed why a raw page.mouse click on
 *     the renderer doesn't reliably set `e.target === rendererRef.current`
 *     under the SceneLayer stack; rather than replay that fight per
 *     hotkey, these tests seed the selection by setting `itemControls`
 *     directly via the debug bridge. The clipboard / delete dispatch is
 *     still driven by the real keyboard handler — only the selection
 *     bootstrap is shortcut.
 *
 * Lib hotkey gate: useInteractionManager filters keydowns whose target is
 * INPUT/TEXTAREA/contenteditable. After clicking the EmptyStateScreen's
 * "New" button, focus sits on a <button>, which passes the filter, so
 * `page.keyboard.press` reaches the lib handler.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelHistoryLength,
  getModelItemCount,
  getViewItemCount,
  waitForDebugBridge
} from '../helpers/store';

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

async function openElementsPanel(page: import('@playwright/test').Page) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  const gridVisible = await gridItem.isVisible().catch(() => false);
  if (!gridVisible) await elementsToggle.click();
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
}

interface CanvasPoint {
  x: number;
  y: number;
}

async function placeIcon(
  page: import('@playwright/test').Page,
  point: CanvasPoint
) {
  await openElementsPanel(page);
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeIcon: missing bounding box');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
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

const getSelectedIdsLength = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().selectedIds.length as number
  );

/**
 * Sets `uiState.itemControls` to the first placed item's id so clipboard
 * dispatch (which reads from itemControls in non-LASSO mode) and Delete
 * (which falls back to itemControls when selectedIds isn't multi-select)
 * have a target. Returns the selected item id for the caller to assert on.
 */
const selectFirstItem = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const state = (window as any).__axoview__.model.getState();
    const items = state.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('selectFirstItem: no items on the model');
    }
    const id = items[0].id;
    (window as any).__axoview__.ui
      .getState()
      .actions.setItemControls({ type: 'ITEM', id });
    return id;
  });

const persistedItemCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('axoview-last-opened-data');
    if (!raw) return -1;
    try {
      const parsed = JSON.parse(raw);
      const items = parsed?.items ?? parsed?.data?.items;
      return Array.isArray(items) ? items.length : -1;
    } catch {
      return -1;
    }
  });

test.describe('Hotkeys — J15 sanity (Ctrl+S/Z/Y/A/C/X/V + Delete)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('Ctrl+S persists the current diagram to localStorage', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('Control+s');
    // saveDiagram() is async; the snapshot writeback is fast but not
    // immediately synchronous, so poll on the persisted count.
    await expect.poll(() => persistedItemCount(page), { timeout: 5_000 }).toBe(1);
  });

  test('Ctrl+Z undoes the last placement', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(0);
  });

  test('Ctrl+Y redoes after Ctrl+Z', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(0);

    await page.keyboard.press('Control+y');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
  });

  test('Ctrl+A selects every interactable item in the active view', async ({ page }) => {
    await placeIcon(page, { x: 360, y: 260 });
    await placeIcon(page, { x: 440, y: 320 });
    await placeIcon(page, { x: 520, y: 380 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(3);

    await page.keyboard.press('Control+a');
    await expect.poll(() => getSelectedIdsLength(page), { timeout: 5_000 }).toBe(3);
  });

  test('Ctrl+C followed by Ctrl+V duplicates the selected item', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await selectFirstItem(page);
    const historyBefore = await getModelHistoryLength(page);

    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
    // Paste should grow history (a paste is a model write).
    await expect
      .poll(() => getModelHistoryLength(page), { timeout: 5_000 })
      .toBeGreaterThan(historyBefore);
  });

  test('Ctrl+X removes the selected item; Ctrl+V restores it from the clipboard', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(1);
    await selectFirstItem(page);

    // Ctrl+X removes the VIEW item (canvas instance). The model-level item
    // catalogue survives the cut — see helpers/store.ts#getViewItemCount.
    await page.keyboard.press('Control+x');
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(0);

    // Ctrl+V pastes — recreates both model and view items at the mouse-
    // anchored centroid. View count climbs back to 1.
    await page.keyboard.press('Control+v');
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(1);
  });

  test('Delete removes the selected item from the canvas', async ({ page }) => {
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(1);
    await selectFirstItem(page);

    // Delete removes the VIEW item. The model-level item remains in the
    // catalogue (J12 / icon-removal flow owns model-level deletion); this
    // test asserts only the visible-on-canvas semantics that J15 verifies.
    await page.keyboard.press('Delete');
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(0);
  });
});
