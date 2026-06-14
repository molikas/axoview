/**
 * touch-resize.spec — dragging a rectangle's transform handle resizes it on
 * touch (previously the handle press wasn't recognised until too late, so the
 * gesture panned). The handle now arms RECTANGLE.TRANSFORM on pointerdown and
 * the touch machine forwards the drag to the resize reducer.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { byAxoviewId } from '../helpers/selectors';
import { getViewRectangleCount } from '../helpers/store';

const firstRect = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const v = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((x: any) => x.id === v) ?? views[0];
    const r = (view.rectangles || [])[0];
    return r ? { from: r.from, to: r.to } : null;
  });

test.describe('Touch — resize a rectangle by dragging a transform handle', () => {
  test('dragging a corner handle changes the rectangle bounds (does not pan)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    // Open + then close the Elements panel so the canvas is unobstructed.
    await placeIconViaMouse(page, { x: 980, y: 60 });
    await clearCanvasForTouch(page);

    // Draw a rectangle via touch (tool mode forwards the gesture).
    await page.keyboard.press('r');
    await page.waitForTimeout(50);
    await touch.dragOneFinger({ x: 480, y: 200 }, { x: 680, y: 340 }, 8);
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);

    // Select it so the transform handles render.
    await page.keyboard.press('s');
    await touch.tapPoint({ x: 560, y: 260 });
    const anchor = byAxoviewId(page, 'canvas-transform-anchor').first();
    await anchor.waitFor({ state: 'visible', timeout: 5_000 });

    const before = await firstRect(page);
    const ab = await anchor.boundingBox();
    if (!ab) throw new Error('transform anchor has no bounding box');

    // Drag the handle — the rectangle resizes (bounds change).
    await touch.dragAbsolute(
      { x: ab.x + ab.width / 2, y: ab.y + ab.height / 2 },
      { x: ab.x + ab.width / 2 - 120, y: ab.y + ab.height / 2 - 90 }
    );

    await expect
      .poll(async () => JSON.stringify(await firstRect(page)), {
        timeout: 5_000
      })
      .not.toBe(JSON.stringify(before));
  });
});
