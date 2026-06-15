/**
 * touch-longpress.spec — ADR 0018 long-press gestures.
 *   - Hold on a node → its context menu (NodeActionBar) opens DURING the hold.
 *   - Hold on empty canvas, then drag → marquee lasso select (no tool switch).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

const nodeTile = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const v = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    return (views.find((x: any) => x.id === v) ?? views[0]).items[0].tile;
  });

const actionBarOpen = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().itemActionBarOpen === true
  );

const selectedIds = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().selectedIds as unknown[]
  );

test.describe('Touch — long-press gestures', () => {
  test('hold on a node opens its context menu (action bar)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);
    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    await touch.hold(await touch.tilePoint(await nodeTile(page)), 600);

    expect(await actionBarOpen(page)).toBe(true);
    await expect
      .poll(async () => (await selectedIds(page)).length, { timeout: 3_000 })
      .toBeGreaterThan(0);
  });

  test('hold on empty then drag does a marquee lasso select', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);
    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    const np = await touch.tilePoint(await nodeTile(page));
    // Hold on empty space (100px above the node tile), then drag a box that
    // encloses it. NB: a *square* screen drag is a degenerate line in isometric
    // tile space (one tile axis gets zero range), so use a tall box that spans
    // both tile axes — this mirrors how the explicit-lasso spec sizes its drag.
    await touch.holdThenDrag(
      { x: np.x - 40, y: np.y - 100 },
      { x: np.x + 40, y: np.y + 100 },
      600,
      8
    );

    // Genuine marquee select — not the long-press-on-node context menu path.
    expect(await actionBarOpen(page)).toBe(false);
    await expect
      .poll(async () => (await selectedIds(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(0);
  });
});
