/**
 * connector.spec.ts — Tier 1 J2.
 *
 * J2 (per docs/manual-test-baseline.md): new diagram → draw a connector
 * between two icons → undo/redo works correctly.
 *
 * Implementation notes:
 *   - Default hotkey profile is `smnrct` (see config/hotkeys.ts); pressing
 *     `c` enters CONNECTOR mode via useInteractionManager. Using the hotkey
 *     instead of a ToolMenu button click means no lib-side retrofit is
 *     required this session — the connector-mode-button data-axoview-id
 *     stays deferred to a later session if a button-driven spec wants it.
 *   - Default `connectorInteractionMode` is `'click'` (uiStateStore.tsx),
 *     so a connector is drawn by clicking the first anchor then the second.
 *     The connector mode's mousedown handler reads tile coords from the
 *     mouse position and snaps to an item via `getItemAtTile` — meaning
 *     clicking at the same canvas-relative screen coord where placeIcon
 *     dropped the item resolves back to the same tile (and the same item)
 *     because the iso projection is deterministic.
 *   - Connector storage lives at `model.views[*].connectors`, not at the
 *     model root. helpers/store.ts#getModelConnectorCount reads the active
 *     view's connectors via the debug bridge.
 *   - Undo/redo uses Ctrl+Z / Ctrl+Y; both are handled in
 *     useInteractionManager keydown when no input element has focus.
 *
 * Lazy data-axoview-id retrofits — none this spec. CanvasPOM owns the
 * `canvas-tool-connector` attribute and lands Session 5; the hotkey path
 * keeps that retrofit deferred until then.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode,
  waitForDebugBridge
} from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

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
  // Mirrors smoke.spec.ts#placeIcon — drag-and-drop from the icon grid onto
  // the canvas at the given canvas-relative coords. page.mouse.* bypasses
  // the icon tile's MUI Tooltip portal that intercepts Locator.dragTo().
  await openElementsPanel(page);
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeIcon: icon or canvas missing a bounding box');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/**
 * Click on the renderer interactions layer at a canvas-relative coord.
 *
 * The lib's interaction handlers (Connector, Cursor, …) gate on
 * `rendererRef.current === e.target` to filter out clicks that landed on a
 * child element instead of the renderer surface. Playwright's
 * page.mouse.down/up dispatches a native event whose `e.target` is whatever
 * elementFromPoint resolves to — which, given the SceneLayer zIndex stack
 * above the interactions Box, is typically not the renderer ref itself.
 *
 * Dispatching synthetic MouseEvents directly on the
 * `[data-axoview-id="canvas-interactions"]` element (added Session 3 to
 * the lib's Renderer interactionsRef Box) sidesteps the elementFromPoint
 * dance: the event still bubbles to the window-level listener, but
 * `e.target` is deterministically the renderer ref, so
 * `isRendererInteraction` is true and the connector handler runs.
 */
async function clickCanvasAt(
  page: import('@playwright/test').Page,
  point: CanvasPoint
) {
  const interactions = byAxoviewId(page, 'canvas-interactions');
  await interactions.evaluate((el, { x, y }) => {
    const rect = el.getBoundingClientRect();
    // ADR 0018: lib listens for Pointer Events now — dispatch PointerEvents with
    // pointerType:'mouse' so the unchanged mouse branch runs.
    const dispatchEvent = (type: string) => {
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          button: 0,
          buttons: type === 'pointerdown' ? 1 : 0,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true
        })
      );
    };
    dispatchEvent('pointermove');
    dispatchEvent('pointerdown');
    dispatchEvent('pointerup');
  }, point);
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

test.describe('Connector — J2: draw + undo/redo between two icons', () => {
  test.beforeEach(async ({ page }) => {
    await pinOnboardingDismissed(page);
  });

  test('J2: places 2 icons, draws connector, undo removes, redo restores', async ({ page, app }) => {
    void app;
    await bootBlankDiagram(page);

    // 1. Place two icons at distinct canvas-relative coords.
    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const ICON_B: CanvasPoint = { x: 520, y: 360 };
    await placeIcon(page, ICON_A);
    await placeIcon(page, ICON_B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    // 2. Enter CONNECTOR mode via the `c` hotkey (default profile = smnrct).
    //    The mode switch is dispatched by useInteractionManager when the
    //    keydown target is not an INPUT/TEXTAREA; the canvas surface is the
    //    default focus target after dragging, so a plain page.keyboard.press
    //    works here.
    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('CONNECTOR');

    // 3. Click the first icon's anchor, then the second.
    //    In click-interaction mode the Connector handler creates the
    //    connector on the first click and commits the second anchor on the
    //    second click — the second click can land on either an item or a
    //    tile, but landing on the dropped-icon coord snaps the anchor to the
    //    item via getItemAtTile.
    await clickCanvasAt(page, ICON_A);
    await page.waitForTimeout(100);
    await clickCanvasAt(page, ICON_B);
    await expect.poll(() => getModelConnectorCount(page), { timeout: 5_000 }).toBe(1);

    // 4. Ctrl+Z removes the connector. The connector lifecycle (create →
    //    commit) lives inside a single drag-transaction (see Connector.ts
    //    beginDragTransaction/commitDragTransaction), so one undo unwinds
    //    the whole create.
    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelConnectorCount(page), { timeout: 5_000 }).toBe(0);

    // 5. Ctrl+Y restores it.
    await page.keyboard.press('Control+y');
    await expect.poll(() => getModelConnectorCount(page), { timeout: 5_000 }).toBe(1);
  });
});
