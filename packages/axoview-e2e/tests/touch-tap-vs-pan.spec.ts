/**
 * touch-tap-vs-pan.spec — ADR 0018 Decision 5 + D-12. A one-finger drag past the
 * tap slop PANS the canvas (scroll changes, no selection / no lasso); a small
 * tap selects. Pan must not select or relocate anything.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import {
  getItemControls,
  getModelItemCount,
  getScroll
} from '../helpers/store';

test.describe('Touch — one-finger drag pans (D-12)', () => {
  test('one-finger drag changes scroll and does not select', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    const before = await getScroll(page);

    // Drag across EMPTY canvas (well past TAP_SLOP_PX) → pan. Under direct
    // manipulation a drag must START on empty space to pan (a drag starting on a
    // node moves the node), so keep well clear of the node placed at ~{420,300}.
    await touch.dragOneFinger({ x: 660, y: 170 }, { x: 780, y: 250 });

    const after = await getScroll(page);
    expect(
      after.position.x !== before.position.x ||
        after.position.y !== before.position.y
    ).toBe(true);

    // A pan must not create a selection.
    expect(await getItemControls(page)).toBeNull();
  });
});
