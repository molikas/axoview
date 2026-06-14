/**
 * touch-drag-move.spec — ADR 0018 (Option A: direct manipulation).
 *
 * Dragging a node directly moves it (no tap-to-place): a one-finger drag that
 * STARTS on a node moves that node; a drag on empty canvas pans (covered by
 * touch-tap-vs-pan). Asserts the node relocates toward the drag end and not to
 * the corner (the old (0,0) touch-synthesis bug).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

const nodeTile = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === viewId) ?? views[0];
    return view.items[0].tile as { x: number; y: number };
  });

test.describe('Touch — drag a node to move it (direct manipulation)', () => {
  test('one-finger drag starting on a node moves it toward the drop; no corner jump', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    const origin = await nodeTile(page);
    const from = await touch.tilePoint(origin);
    const target = { x: origin.x + 3, y: origin.y + 2 };
    const to = await touch.tilePoint(target);

    // Drag from the node to the target tile (one finger, starts on the node).
    await touch.dragOneFinger(from, to, 8);

    const placed = await nodeTile(page);
    expect(placed).not.toEqual(origin);
    expect(placed).not.toEqual({ x: 0, y: 0 });
    expect(Math.abs(placed.x - target.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(placed.y - target.y)).toBeLessThanOrEqual(1);
  });
});
