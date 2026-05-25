/**
 * connector-creation.spec.ts — v1.1 Track 5e-2.
 *
 * Cross-interaction coverage for connector creation across boundaries.
 * The J2 happy path in `connector.spec.ts` only exercises an icon-to-icon
 * (anchored-to-anchored) connector and never inspects the anchor shape;
 * PR #6 surfaced that the anchor-binding kind (item ref vs tile ref) is
 * load-bearing for the lasso delete-cascade contract. 5e-2 pins:
 *
 *   anchored-to-anchored — icon-to-icon click-click. Both anchors carry
 *                          a `ref.item` referencing the source/target
 *                          view-items.
 *
 *   mixed                — icon-to-free-tile click-click. anchors[0] is
 *                          item-bound; anchors[1] is tile-bound.
 *
 *   cancel-mid-drag      — enter CONNECTOR mode, place the first anchor,
 *                          press Escape before the second. The
 *                          useInteractionManager Escape handler calls
 *                          `deleteConnector(mode.id)` on the in-flight
 *                          partial connector and exits to the
 *                          `id: null, isConnecting: false` state. The
 *                          model's connector count must NOT carry the
 *                          half-formed connector.
 *
 * Free-to-free creation is already covered by 5e-1's free-tile setup —
 * skipped here to avoid duplication.
 *
 * Lazy data-axoview-id retrofits — none. All hotkey + coord-dispatch
 * driven; the icon-placement helper consumes already-landed attributes.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode
} from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

/**
 * Reads the active view's first connector's anchor refs, returning a
 * compact shape for E2E assertions: `[{kind, hasId}, {kind, hasId}]`
 * where `kind` is 'item' | 'tile' and `hasId` is whether the ref's
 * payload is a non-empty string/object.
 */
const getFirstConnectorAnchorKinds = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    if (!Array.isArray(views) || views.length === 0) return null;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const connectors = view?.connectors ?? [];
    if (connectors.length === 0) return null;
    const c = connectors[0];
    if (!Array.isArray(c.anchors) || c.anchors.length < 2) return null;
    const kindOf = (a: any) => {
      if (a?.ref?.item) return 'item';
      if (a?.ref?.tile) return 'tile';
      return 'unknown';
    };
    return [kindOf(c.anchors[0]), kindOf(c.anchors[c.anchors.length - 1])];
  });

async function placeIcon(
  page: import('@playwright/test').Page,
  point: CanvasPoint
) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await firstIcon.isVisible().catch(() => false))) {
    await elementsToggle.click();
    await firstIcon.waitFor({ state: 'visible', timeout: 5_000 });
  }
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox)
    throw new Error('placeIcon: icon or canvas missing a bounding box');
  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, {
    steps: 10
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test.describe('Connector creation across boundaries — Track 5e-2', () => {
  test('5e-2 anchored-to-anchored: icon-to-icon connector has item-bound anchors at both ends', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const ICON_B: CanvasPoint = { x: 540, y: 360 };
    await placeIcon(page, ICON_A);
    await placeIcon(page, ICON_B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );

    await canvas.clickAt(ICON_A);
    await page.waitForTimeout(100);
    await canvas.clickAt(ICON_B);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    // Both anchors carry `ref.item` — pre/post lasso contract.
    const kinds = await getFirstConnectorAnchorKinds(page);
    expect(kinds).toEqual(['item', 'item']);
  });

  test('5e-2 mixed: icon-to-free-tile connector has item-bound start and tile-bound end', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const FREE_TILE: CanvasPoint = { x: 600, y: 420 };
    await placeIcon(page, ICON_A);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );

    await canvas.clickAt(ICON_A);
    await page.waitForTimeout(100);
    await canvas.clickAt(FREE_TILE);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    const kinds = await getFirstConnectorAnchorKinds(page);
    expect(kinds).toEqual(['item', 'tile']);
  });

  test('5e-2 cancel-mid-drag: Escape after first click discards the in-flight connector', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    await placeIcon(page, ICON_A);

    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );

    // First click — connector created with anchors[0,1] both bound to ICON_A.
    // isConnecting flips true; mode.id holds the new connector id.
    await canvas.clickAt(ICON_A);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    // Escape — useInteractionManager.handleKeyDown's CONNECTOR-mode branch
    // calls deleteConnector(mode.id) when isConnecting is true and resets
    // the mode to a clean CONNECTOR slot.
    await page.keyboard.press('Escape');
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(0);
    // Mode stays CONNECTOR but the id slot clears so a fresh click starts
    // a new connector.
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );
  });
});
