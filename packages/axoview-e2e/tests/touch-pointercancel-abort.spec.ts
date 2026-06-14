/**
 * touch-pointercancel-abort.spec — ADR 0018 Decision 4/6. A SECOND finger landing
 * during a GRAB (carry) ABORTS the carry — the node stays at its origin (the
 * model was never written) and it does NOT zoom. Context precedence: a 2nd finger
 * during a carry is an abort, not a pinch.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getModelItemCount, getUiMode } from '../helpers/store';

const nodeTile = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === viewId) ?? views[0];
    return view.items[0].tile as { x: number; y: number };
  });

test.describe('Touch — second finger aborts a carry (Decision 6 precedence)', () => {
  test('2nd finger mid-grab aborts; node stays at origin, mode leaves CARRY_ITEM', async ({
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

    // Select then grab.
    await touch.tapTile(origin);
    await touch.tapTile(origin);
    await expect
      .poll(async () => (await getUiMode(page)).type, { timeout: 5_000 })
      .toBe('CARRY_ITEM');

    // Land a second finger somewhere on the canvas → abort.
    const originPx = await touch.tilePoint(origin);
    await touch.secondFingerTap(originPx, {
      x: originPx.x + 120,
      y: originPx.y + 40
    });

    // Carry aborted: mode left CARRY_ITEM and the node never moved.
    await expect
      .poll(async () => (await getUiMode(page)).type, { timeout: 5_000 })
      .not.toBe('CARRY_ITEM');
    expect(await nodeTile(page)).toEqual(origin);
  });
});
