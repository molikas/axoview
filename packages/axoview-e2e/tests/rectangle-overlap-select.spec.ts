/**
 * rectangle-overlap-select.spec.ts — regression: clicking overlapping
 * rectangles selects the one drawn ON TOP.
 *
 * Reported 2026-07-01: with two overlapping rectangles, clicking the overlap
 * selected the rectangle UNDERNEATH. Root cause: getItemAtTile picked the first
 * insertion-order match and ignored zIndex, while Rectangles.tsx paints
 * reversed-insertion + zIndex-sorted (so the newest / highest-z is on top). The
 * hit-test now matches the paint order and returns the visually-topmost rect.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { getViewRectangleCount, getItemControls } from '../helpers/store';

type Page = import('@playwright/test').Page;

const rectIds = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    return (view.rectangles ?? []).map((r: any) => r.id);
  });

test.describe('Rectangle overlap selection', () => {
  test('clicking the overlap selects the rectangle drawn on top (newest)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Rect A first (ends up underneath).
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(
      await canvas.tileToScreen({ x: -3, y: -3 }),
      await canvas.tileToScreen({ x: 1, y: 1 })
    );
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);

    // Rect B second (drawn on top), overlapping A around tile (0,0).
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(
      await canvas.tileToScreen({ x: 0, y: 0 }),
      await canvas.tileToScreen({ x: 4, y: 4 })
    );
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(2);

    // createRectangle unshifts, so index 0 is the newest (B) — the top rect.
    const bId = (await rectIds(page))[0];

    await page.keyboard.press('s');
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setItemControls(null)
    );

    // Click the shared overlap tile — must select B (on top), not A underneath.
    await canvas.clickAt(await canvas.tileToScreen({ x: 0, y: 0 }));
    await expect
      .poll(async () => (await getItemControls(page))?.id ?? null, {
        timeout: 3_000
      })
      .toBe(bId);
  });
});
