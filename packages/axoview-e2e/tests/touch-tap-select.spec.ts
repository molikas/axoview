/**
 * touch-tap-select.spec — ADR 0018 §5.1 P0 (touch coverage was a TOTAL gap).
 *
 * A single-finger tap on a node selects it (Properties opens via itemControls);
 * a tap on empty canvas clears the selection. Drives real touch input
 * (page.touchscreen.tap) — the mouse path is exercised separately.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getItemControls, getModelItemCount } from '../helpers/store';

test.describe('Touch — tap to select / clear (ADR 0018)', () => {
  test('tap a node selects it; tap empty clears', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    // Real touch hit-tests — close the panel so it can't intercept canvas taps.
    await clearCanvasForTouch(page);

    // The placed node's tile, read from the active view.
    const nodeTile = await page.evaluate(() => {
      const viewId = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      const view = views.find((v: any) => v.id === viewId) ?? views[0];
      return view.items[0].tile;
    });

    // Tap the node → selected (itemControls populated for that item).
    await touch.tapTile(nodeTile);
    await expect
      .poll(async () => (await getItemControls(page))?.type, { timeout: 5_000 })
      .toBe('ITEM');

    // Tap an empty on-canvas point (box-relative, clear of the node) → cleared.
    await touch.tapPoint({ x: 700, y: 160 });
    await expect
      .poll(async () => await getItemControls(page), { timeout: 5_000 })
      .toBeNull();
  });
});
