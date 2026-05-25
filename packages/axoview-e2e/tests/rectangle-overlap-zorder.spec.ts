/**
 * rectangle-overlap-zorder.spec.ts — v1.1 Finding #5 (KR2 helper-consumer).
 *
 * Closes Finding #5 in docs/tactical/v1.1-test-coverage.md — the
 * "rectangle z-order on overlap (visual stacking)" sub-row of 5e-4 that
 * z-order.spec.ts deliberately did not cover (z-order.spec.ts pins the
 * Ctrl+] / Ctrl+[ hotkey contract on ITEM z-index; this spec pins the
 * Rectangle-vs-Item layering at the canvas layer).
 *
 * Renderer layering (Renderer.tsx:178-235): the Rectangles SceneLayer
 * is the FIRST child of the canvas container; the Nodes SceneLayer
 * comes AFTER the interactions Box. CSS painting order = DOM order at
 * equal z-index, so items always paint above rectangles.
 *
 * The user-visible consequence of that layering is the hit-test order
 * in utils/hitDetection.ts:43-95 (`getItemAtTile`): items first, then
 * textboxes, then connectors, then rectangles. A click on a tile where
 * both an item AND a rectangle exist must select the ITEM; a click on
 * a tile that's inside the rectangle but has no item must select the
 * RECTANGLE. This contract is what users see as "the rectangle stays
 * underneath," and it is the hit-test mirror of the SceneLayer paint
 * order — both seams are testing the same invariant.
 *
 * Why hit-test rather than literal DOM-stack assertions: the lib's
 * Rectangle component has no observable data attribute (it renders
 * through IsoTileArea + Svg with no test-only hooks), so a DOM-stack
 * probe would have to dead-reckon on SceneLayer order — a brittle
 * coupling to internal component composition. The hit-test layer is
 * the user-observable surface that the layering serves; pinning it
 * pins the contract end-to-end.
 *
 * The iso tile->screen helper from KR1 is what makes this testable —
 * it converts a known interior tile of the rectangle to a known canvas
 * pixel for the synthetic mouse dispatch.
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getItemControls,
  getModelItemCount,
  getViewRectangleCount
} from '../helpers/store';

const getFirstRectangleBounds = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const r = (view?.rectangles ?? [])[0];
    if (!r) return null;
    return { id: r.id, from: r.from, to: r.to };
  });

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

test.describe('Rectangle z-order on overlap — Finding #5', () => {
  test('item over rectangle: click on item-tile selects ITEM; click on bare rect-tile selects RECTANGLE', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Draw a rectangle by planning the drag in TILE coords and
    //    projecting through tileToScreen. Picking pixels directly is
    //    brittle because the iso projection means a wide-looking
    //    screen-x drag may map to only one tile (projectedWidth=141.5,
    //    halfW=70.75 means a 100px x-drag stays within one tile if
    //    the y-component happens to compensate). Tile-coord planning
    //    deterministically produces a 5x5 rectangle.
    const RECT_FROM_TILE = { x: -2, y: -2 };
    const RECT_TO_TILE = { x: 2, y: 2 };
    const rectFromPixel = await canvas.tileToScreen(RECT_FROM_TILE);
    const rectToPixel = await canvas.tileToScreen(RECT_TO_TILE);
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(rectFromPixel, rectToPixel);
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);

    const rect = await getFirstRectangleBounds(page);
    expect(rect).not.toBeNull();

    const minX = Math.min(rect!.from.x, rect!.to.x);
    const maxX = Math.max(rect!.from.x, rect!.to.x);
    const minY = Math.min(rect!.from.y, rect!.to.y);
    const maxY = Math.max(rect!.from.y, rect!.to.y);
    expect(maxX - minX).toBeGreaterThanOrEqual(2);
    expect(maxY - minY).toBeGreaterThanOrEqual(2);

    const ITEM_TILE = { x: minX + 1, y: minY + 1 };
    const BARE_RECT_TILE = { x: maxX, y: maxY };
    expect(ITEM_TILE.x !== BARE_RECT_TILE.x || ITEM_TILE.y !== BARE_RECT_TILE.y).toBe(true);

    // Drop an icon at ITEM_TILE via the iso projection helper. The
    //  existing placeIcon helper takes canvas pixels; tileToScreen
    //  gives the canvas pixel that maps back to ITEM_TILE.
    const itemDropPixel = await canvas.tileToScreen(ITEM_TILE);
    await placeIcon(page, itemDropPixel);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    const placed = await getFirstItemTileAndId(page);
    expect(placed).not.toBeNull();
    expect(placed!.tile).toEqual(ITEM_TILE);

    // 3. CURSOR mode + clear pre-existing selection.
    await page.keyboard.press('s');
    await page.evaluate(() => {
      const ui = (window as any).__axoview__.ui;
      ui.getState().actions.setItemControls(null);
    });

    // 4. Click the item's tile — hitDetection.ts:50-56 returns ITEM
    //    first (items index lookup), even though the rectangle
    //    encloses this tile. Item wins the z-order.
    const itemPixel = await canvas.tileToScreen(ITEM_TILE);
    await canvas.clickAt(itemPixel);
    await expect
      .poll(async () => (await getItemControls(page))?.type ?? null, {
        timeout: 3_000
      })
      .toBe('ITEM');
    const ctrlA = await getItemControls(page);
    expect(ctrlA?.id).toBe(placed!.id);

    // 5. Clear selection, click a tile that's inside the rectangle but
    //    has no item — the same hit-test now falls through to the
    //    rectangle branch (hitDetection.ts:88-92) and selects the
    //    rect. The rectangle visible-stack contract holds: where an
    //    item exists, the item is on top; where no item exists, the
    //    rectangle is hit-testable.
    await page.evaluate(() => {
      const ui = (window as any).__axoview__.ui;
      ui.getState().actions.setItemControls(null);
    });
    const barePixel = await canvas.tileToScreen(BARE_RECT_TILE);
    await canvas.clickAt(barePixel);
    await expect
      .poll(async () => (await getItemControls(page))?.type ?? null, {
        timeout: 3_000
      })
      .toBe('RECTANGLE');
    const ctrlB = await getItemControls(page);
    expect(ctrlB?.id).toBe(rect!.id);
  });
});
