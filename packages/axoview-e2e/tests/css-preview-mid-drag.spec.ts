/**
 * css-preview-mid-drag.spec — behavior-map §3.4 P0 (the single highest-value,
 * easiest-to-break perf invariant). During a node drag the model is NOT written
 * per frame: live position lives ONLY in the `--ff-drag-dx/dy` CSS variables on
 * the `[data-drag-id]` element; `view.items[].tile` stays stale until mouseup.
 *
 * This guards that the Pointer-Events rewrite did not start writing the model per
 * pointermove (which would reinstate the MQA #7 cliff). It pauses a drag mid-flight
 * (down + a tile-crossing move, before the up) and asserts: the dragged node's
 * `[data-drag-id]` carries a non-zero `--ff-drag-*` while its model tile is
 * unchanged. The up then commits the new tile.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

const firstItem = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const v = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((x: any) => x.id === v) ?? views[0];
    const it = view.items[0];
    return { id: it.id, tile: it.tile as { x: number; y: number } };
  });

// Reads the live --ff-drag-dx/dy off the dragged node's [data-drag-id] element.
const dragVars = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((nodeId: string) => {
    const el = document.querySelector(`[data-drag-id="${nodeId}"]`);
    if (!el) return null;
    const s = getComputedStyle(el as HTMLElement);
    return {
      dx: s.getPropertyValue('--ff-drag-dx').trim(),
      dy: s.getPropertyValue('--ff-drag-dy').trim()
    };
  }, id);

test.describe('CSS-preview node drag — model unwritten mid-drag (§3.4 P0)', () => {
  test('mid-drag the model tile is unchanged while [data-drag-id] carries --ff-drag', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    const start = await firstItem(page);
    const fromPx = await canvas.tileToScreen(start.tile);
    const toTile = { x: start.tile.x + 3, y: start.tile.y + 2 };
    const toPx = await canvas.tileToScreen(toTile);

    // Begin the drag and walk across several tiles — but do NOT release yet.
    // Multiple moves are needed: one move flips CURSOR→DRAG_ITEMS, subsequent
    // moves run DragItems.mousemove which writes the --ff-drag preview.
    await canvas.dispatchAt(['mousemove'], fromPx);
    await canvas.dispatchAt(['mousedown'], fromPx);
    for (let i = 1; i <= 4; i++) {
      await canvas.dispatchAt(['mousemove'], {
        x: fromPx.x + ((toPx.x - fromPx.x) * i) / 4,
        y: fromPx.y + ((toPx.y - fromPx.y) * i) / 4
      });
    }

    // INVARIANT: model tile still at origin; live offset is in CSS vars only.
    const midDrag = await firstItem(page);
    expect(midDrag.tile).toEqual(start.tile);
    const vars = await dragVars(page, start.id);
    expect(vars).not.toBeNull();
    const moved =
      (vars!.dx !== '' && vars!.dx !== '0px' && vars!.dx !== '0') ||
      (vars!.dy !== '' && vars!.dy !== '0px' && vars!.dy !== '0');
    expect(moved).toBe(true);

    // Release commits the new tile to the model.
    await canvas.dispatchAt(['mouseup'], toPx);
    await expect
      .poll(async () => {
        const after = await firstItem(page);
        return after.tile.x !== start.tile.x || after.tile.y !== start.tile.y;
      }, { timeout: 5_000 })
      .toBe(true);
  });
});
