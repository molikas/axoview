/**
 * iso-helper-smoke.spec.ts — v1.1 KR1 (Findings #4/#5/#6/#7 unblock).
 *
 * Canary for `CanvasPOM.tileToScreen`. The helper mirrors the lib's iso
 * projection (`packages/axoview-lib/src/utils/coordinateTransforms.ts:94-105`
 * + constants from `config.ts:16-24`) — if the lib changes the math, this
 * spec must fail so the downstream specs that consume the helper
 * (multi-select pure-lasso, rectangle move/resize, textbox text-edit/resize,
 * rectangle z-order) do not silently land their clicks on the wrong tile.
 *
 * Smoke contract: place an icon at a known canvas pixel; read the model
 * for the tile that the lib's `screenToTile` mapped the drop to; pass that
 * tile through `tileToScreen`; click the returned pixel via the synthetic
 * mouse dispatch on canvas-interactions; assert the click selects the same
 * item (itemControls.id matches the placed item's id).
 *
 * Tolerance model: not a 1-pixel arithmetic check (the drop pixel can sit
 * anywhere INSIDE the landed tile; `screenToTile` floors, `tileToScreen`
 * returns the tile center). Instead a behavioural roundtrip — the helper
 * must point at a pixel that the lib's hit-test resolves back to the same
 * tile. This is the contract the downstream specs need: "click landed on
 * the right tile", not "pixel-precise."
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getItemControls, getModelItemCount } from '../helpers/store';

const getFirstItemTileAndId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const item = (view?.items ?? [])[0];
    if (!item) return null;
    return { id: item.id, tile: item.tile };
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

test.describe('Iso helper smoke — KR1 (Findings #4-#7 unblock)', () => {
  test('tileToScreen roundtrips an item tile back to a click that selects it', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Place an icon at a known canvas-relative pixel.
    const DROP: CanvasPoint = { x: 380, y: 280 };
    await placeIcon(page, DROP);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    const placed = await getFirstItemTileAndId(page);
    expect(placed).not.toBeNull();

    // Round-trip: the placed tile, projected back to a screen pixel via
    // tileToScreen, then clicked, must select the same item.
    const screen = await canvas.tileToScreen(placed!.tile);

    // Ensure CURSOR mode for select-on-click.
    await page.keyboard.press('s');

    // Clear any pre-existing selection so the assertion is unambiguous.
    await page.evaluate(() => {
      const ui = (window as any).__axoview__.ui;
      ui.getState().actions.setItemControls(null);
    });

    await canvas.clickAt(screen);

    await expect
      .poll(async () => (await getItemControls(page))?.id ?? null, {
        timeout: 3_000
      })
      .toBe(placed!.id);
  });
});
