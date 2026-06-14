/**
 * touch-lasso-select.spec — ADR 0018 (direct manipulation). Tool modes must
 * still own the drag on touch: in LASSO mode a one-finger drag builds the
 * marquee and selects, instead of panning. (Regression: the touch machine only
 * handled CURSOR select/drag/pan and never forwarded the gesture to an active
 * tool mode, so lasso/freehand did nothing on touch.) FREEHAND_LASSO shares the
 * exact same "tool mode → forward the gesture" path.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getModelItemCount, getUiMode } from '../helpers/store';

const selectedIds = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().selectedIds as unknown[]
  );

test.describe('Touch — lasso marquee select (tool mode owns the drag)', () => {
  test('a one-finger drag in LASSO mode selects the enclosed node (does not pan)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    const node = await page.evaluate(() => {
      const v = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      return (views.find((x: any) => x.id === v) ?? views[0]).items[0].tile;
    });
    const np = await touch.tilePoint(node);

    await page.keyboard.press('l');
    await expect
      .poll(async () => (await getUiMode(page)).type, { timeout: 2_000 })
      .toBe('LASSO');

    // Drag a box around the node — forwarded to Lasso, builds the marquee.
    await touch.dragOneFinger(
      { x: np.x - 60, y: np.y - 60 },
      { x: np.x + 60, y: np.y + 60 },
      8
    );

    await expect
      .poll(async () => (await selectedIds(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(0);
  });
});
