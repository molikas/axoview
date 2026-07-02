/**
 * canvas-selection-polish.spec.ts — 2026-07-02 shake-out.
 *   - Lasso completes to CURSOR: after a marquee, a plain click on empty canvas
 *     (even inside the former box) clears the selection (Figma/draw.io parity).
 *   - Double-clicking a node's on-canvas label enters inline rename (parity with
 *     connector labels; node labels are Canvas2D at rest, reached via the DOM
 *     hit proxy).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const selectedCount = (page: Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().selectedIds.length
  );
const modeType = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().mode.type);
const itemTiles = (page: Page) =>
  page.evaluate(() => {
    const v = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    return (views.find((x: any) => x.id === v) ?? views[0]).items.map(
      (i: any) => i.tile
    );
  });

test.describe('Canvas selection polish', () => {
  test('lasso completes to CURSOR; an empty click inside the box clears it', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    await placeIconViaMouse(page, { x: 380, y: 280 });
    await placeIconViaMouse(page, { x: 520, y: 340 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
    await page.keyboard.press('s');

    const tiles = await itemTiles(page);
    const a = await canvas.tileToScreen(tiles[0]);
    const b = await canvas.tileToScreen(tiles[1]);
    const minX = Math.min(a.x, b.x) - 60;
    const maxX = Math.max(a.x, b.x) + 60;
    const minY = Math.min(a.y, b.y) - 80;
    const maxY = Math.max(a.y, b.y) + 80;
    await canvas.dragFromTo({ x: minX, y: minY }, { x: maxX, y: maxY });

    await expect
      .poll(() => selectedCount(page), { timeout: 3_000 })
      .toBeGreaterThanOrEqual(2);
    expect(await modeType(page)).toBe('CURSOR');

    // Click an empty spot INSIDE the former marquee box → clears.
    await canvas.clickAt({ x: (minX + maxX) / 2, y: minY + 8 });
    await expect.poll(() => selectedCount(page), { timeout: 3_000 }).toBe(0);
  });

  test('double-clicking a node label enters inline rename', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    await placeIconViaMouse(page, { x: 440, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await page.keyboard.press('s');
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setItemControls(null)
    );

    const proxy = page.locator('[data-axoview-id="canvas-label-hit"]').first();
    await proxy.waitFor({ state: 'visible', timeout: 3_000 });
    await proxy.dblclick();

    await expect
      .poll(
        () =>
          page
            .locator('[data-testid="node-label"] [contenteditable="true"]')
            .count(),
        { timeout: 3_000 }
      )
      .toBeGreaterThan(0);
  });
});
